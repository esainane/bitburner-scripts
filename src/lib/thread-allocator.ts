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

  private available_runners: Array<Runner> = [];
  private available_threads = 0;

  public async refresh() {
    const servers = await find_servers(this.ns);
    const { available_runners, available_threads } = await find_runners(this.ns, servers, 'worker/grow1.ts', this.exclude_runners);
    [ this.available_runners, this.available_threads ] = [ available_runners, available_threads ];
  }

  public availableRunners(): Array<Runner> {
    return this.available_runners;
  }

  public availableThreads(): number {
    return this.available_threads;
  }

  private async exec(script: string, hostname: string, threads_or_options: number | RunOptions, ...args: ScriptArg[]): Promise<number> {
    if (!this.ns.fileExists(script, hostname)) {
      this.ns.scp(script, hostname, 'home');
    }
    const threads: number = (typeof(threads_or_options) === 'number') ? threads_or_options : threads_or_options.threads ?? 1;
    this.available_threads -= threads;
    const runner = this.available_runners.find(r => r.server === hostname);
    if (runner) {
      runner.threads -= threads;
      runner.used_ram += threads * this.ns.getScriptRam(script, 'home');
    }
    return this.ns.exec(script, hostname, threads_or_options, ...args);
  }

  private async _allocateThreads(script: string, threads: number, cumulative = false, maximize_if_fragmented = false, allow_avoided_servers = false, ...args: ScriptArg[]): Promise<[number, number[]]> {
    // If we're not allowed to use avoided servers, remove them from the list
    let available_runners = this.available_runners;
    let available_threads = recalculate_threads(this.ns, available_runners, script);
    if (!allow_avoided_servers) {
      available_runners = available_runners.filter(r => !this.avoid_runners.has(r.server));
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
        const avoid_l = this.avoid_runners.has(l.server);
        const avoid_r = this.avoid_runners.has(r.server);
        if (avoid_l != avoid_r) {
          return avoid_l ? 1 : -1;
        }
        return l.threads - r.threads
      } : (l, r) => l.threads - r.threads);
      let remaining = threads;
      for (const runner of available_runners) {
        const to_allocate = Math.min(remaining, runner.threads);
        if (to_allocate < 1) {
          break;
        }
        pids.push(await this.exec(script, runner.server, { threads: to_allocate, temporary: true }, ...args));
        remaining -= to_allocate;
        if (remaining < 1) {
          break;
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
      pids.push(await this.exec(script, current_runner.server, { threads: current_runner.threads, temporary: true }, ...args));
      return [threads - current_runner.threads, pids];
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
  public async allocateThreads(script: string, threads: number, cumulative = false, ...args: ScriptArg[]): Promise<[number, number[]]> {
    if (threads < 1) {
      // Nothing to do
      return [0, []];
    }
    let [remaining, pids] = await this._allocateThreads(script, threads, cumulative, false, false, ...args);
    if (remaining) {
      let new_pids;
      [remaining, new_pids] = await this._allocateThreads(script, remaining, cumulative, true, true, ...args);
      pids = pids.concat(new_pids);
    }
    return [remaining, pids];
  }
}

export async function main(ns: NS): Promise<void> {
  //
}
