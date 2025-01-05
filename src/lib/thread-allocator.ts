import { NS, RunOptions, ScriptArg } from '@ns'
import { find_servers } from './find-servers';
import { find_runners, recalculate_threads, Runner } from './find-runners';

export class ThreadAllocator {
  constructor(private ns: NS, private exclude_runners: Set<string>, private avoid_runners: Set<string>) {
    this.ns = ns;

    this.exclude_runners = exclude_runners;
    this.avoid_runners = avoid_runners;

    this.refresh();
  }

  private is_avoided(s: string): boolean {
    // Always try to avoid hacknet servers
    // FIXME: Ugly special casing
    return this.avoid_runners.has(s) || s.startsWith('hacknet-server');
  }

  private available_runners: Array<Runner> = [];
  private available_threads = 0;

  public refresh() {
    const servers = find_servers(this.ns);
    const { available_runners, available_threads } = find_runners(this.ns, servers, 'worker/grow1.js', this.exclude_runners);
    [ this.available_runners, this.available_threads ] = [ available_runners, available_threads ];
  }

  public availableRunners(): Array<Runner> {
    return this.available_runners;
  }

  public availableThreads(): number {
    return this.available_threads;
  }

  private async exec(script: string, hostname: string, options: RunOptions, ...args: ScriptArg[]): Promise<number> {
    //this.ns.tprint('Attempting to exec(', script, ', ', hostname, ', ', options, ', ', ...args.join(', '), ')');
    if (!this.ns.fileExists(script, hostname)) {
      // this.ns.tprint('Attempting to scp(', script, ',', hostname, ',home)');
      const copy_ok = this.ns.scp(script, hostname, 'home');
      if (!copy_ok) {
        this.ns.tprint('Failed to scp(', script, ',', hostname, ',home)');
        return 0;
      }
    }
    const threads: number = (typeof(options) === 'number') ? options : options.threads ?? 1;
    this.available_threads -= threads;
    const runner = this.available_runners.find(r => r.server === hostname);
    if (runner) {
      const is_home = hostname === 'home';
      const newly_using = threads * (options.ramOverride ?? this.ns.getScriptRam(script, 'home'));
      if (is_home) {
        const home_actual_available = this.ns.getServerMaxRam('home') - this.ns.getServerUsedRam('home');
        if (home_actual_available >= 82 && home_actual_available - newly_using < 82) {
          // Going below the soft threshold, raise a warning if we're meant to normally exclude home
          if (this.exclude_runners.has('home')) {
            this.ns.tprint('ERROR Home server is running low on memory');
          // } else {
          //   this.ns.tprint('WARNING Home server is running low on memory');
          }
        }
      }
      runner.threads -= threads;
      runner.used_ram += newly_using;
    } else {
      this.ns.tprint('WARNING Could not runner to update for ', hostname, ', later allocations may overallocate or fail!');
    }
    const pid = this.ns.exec(script, hostname, options, ...args);
    if (pid == 0) {
      this.ns.tprint('ERROR failed to exec(', script, ', ', hostname, ', ', options, ', ', ...args.join(', '), ')');
    } else {
      //this.ns.tprint('OK exec(', script, ', ', hostname, ', ', options, ', ', ...args.join(', '), ') -> ', pid);
    }
    return pid;
  }

  public largestContiguousBlock({ topN = 1, allow_avoided_servers = false} = {}): number[] {
    const ret = [...this.available_runners]
      .filter(allow_avoided_servers ? () => true : d => !this.is_avoided(d.server))
      .map(d => d.threads)
      .sort((l, r) => r - l);
    // this.ns.tprint('Largest contiguous block: ', ret, ' from [', this.available_runners.map(d => d.threads).join(', '), '] (', this.available_threads, ' total)');
    return ret.slice(0, topN).concat(Array(Math.max(0, topN - ret.length)).fill(0));
  }

  private async _allocateThreads(script: string, options: RunOptions, cumulative = false, maximize_if_fragmented = false, allow_avoided_servers = false, ...args: ScriptArg[]): Promise<[number, number[]]> {
    const threads = options.threads ?? 1;
    // If we're not allowed to use avoided servers, remove them from the list
    let available_runners = this.available_runners;
    let available_threads = recalculate_threads(this.ns, available_runners, script, options);
    if (!allow_avoided_servers) {
      available_runners = available_runners.filter(r => !this.is_avoided(r.server));
      available_threads = available_runners.reduce((acc, r) => acc + r.threads, 0);
    }
    if (available_threads < threads) {
      // Not enough threads available
      return [threads, []];
    }
    const pids: Array<number> = [];
    // If we're cumulative, use the servers with the least available memory first
    if (cumulative) {
      available_runners.sort(allow_avoided_servers ? (l, r) => {
        // Avoid servers if we can
        const avoid_l = this.is_avoided(l.server);
        const avoid_r = this.is_avoided(r.server);
        if (avoid_l != avoid_r) {
          return avoid_l ? 1 : -1;
        }
        return l.threads - r.threads
      } : (l, r) => l.threads - r.threads);
      let remaining = threads;
      for (const runner of available_runners) {
        const to_allocate = Math.min(remaining, runner.threads);
        if (to_allocate < 1) {
          continue;
        }
        const pid = await this.exec(script, runner.server, { ...options, threads: to_allocate }, ...args);
        if (pid) {
          pids.push(pid);
          remaining -= to_allocate;
          if (remaining < 1) {
            break;
          }
        }
      }
      return [remaining, pids];
    }
    // Otherwise, find the smallest available server with enough threads
    let current_runner = available_runners.find(r => r.threads >= threads);
    // Nothing suitable
    if (!current_runner) {
      if (!maximize_if_fragmented) {
        // no luck, maybe try again in _allocateThreads
        return [threads, pids];
      }
      // Find the largest contiguous block available, do what we can
      available_runners.sort((l, r) => r.threads - l.threads);
      current_runner = available_runners[0];
    }
    if (current_runner) {
      const to_allocate = Math.min(threads, current_runner.threads);
      const pid = await this.exec(script, current_runner.server, { ...options, threads: to_allocate }, ...args);
      if (pid) {
        pids.push(pid);
        return [threads - to_allocate, pids];
      }
    }
    return [threads, pids];
  }
  /**
   * Allocate threads to a particular script
   * @param script Script to run
   * @param threads Threads to allocate
   * @param cumulative True if the threads can be split over many instances with the same effect
   * @returns [unallocatable_threads, [pids]]
   */
  public async allocateThreads(script: string, threads_or_options: number | RunOptions, cumulative = false, ...args: ScriptArg[]): Promise<[number, number[]]> {
    const threads: number = (typeof(threads_or_options) === 'number') ? threads_or_options : threads_or_options.threads ?? 1;
    const options: RunOptions = (typeof(threads_or_options) === 'number') ? { threads } : threads_or_options;
    if (options.temporary === undefined) {
      options.temporary = true;
    }
    if (threads < 1) {
      // Nothing to do
      return [0, []];
    }
    let [remaining, pids] = await this._allocateThreads(script, options, cumulative, false, false, ...args);
    if (remaining) {
      let new_pids;
      [remaining, new_pids] = await this._allocateThreads(script, { ...options, threads: remaining }, cumulative, true, true, ...args);
      pids = pids.concat(new_pids);
    }
    return [remaining, pids];
  }

  public getAllocator(): ((script: string, threads_or_options: number | RunOptions, cumulative?: boolean, ...args: ScriptArg[]) => Promise<[number, number[]]>) {
    return this.allocateThreads.bind(this);
  }
}

function mock_ns(real_ns: NS): NS {
  return {
    ...real_ns,
    scan: (host = 'home') => host == 'home' ? ['a', 'b', 'c'] : [],
    exec: () => 1,
    fileExists: () => true,
    getScriptRam: () => 2,
    getServerMaxRam: (host: string) => 1024,
    getServerUsedRam: (host: string) => 0,
    scp: () => true,
  };
}

export async function main(real_ns: NS): Promise<void> {
  //
}
