import { NS, RunOptions, ScriptArg } from '@ns'
import { find_servers } from './find-servers';

export interface Runner { server: string, threads: number }

export interface RunnersData {
  available_runners: Array<Runner>;
  available_threads: number;
}

export class ThreadAllocator {
  constructor(private ns: NS, private exclude_runners: Set<string>, private avoid_runners: Set<string>) {
    this.ns = ns;

    this.exclude_runners = exclude_runners;
    this.avoid_runners = avoid_runners;
  }


  private async find_runners(servers: Array<string>, script = 'worker/grow1.ts'): Promise<RunnersData> {
    const available_runners: Array<Runner> = [];
    let total_available_threads = 0;

    const ram_per_thread = this.ns.getScriptRam(script, 'home');

    for (const s of servers) {
      if (!this.ns.hasRootAccess(s)) {
        continue;
      }
      if (this.exclude_runners.has(s)) {
        continue;
      }
      const server_available_threads = Math.floor((this.ns.getServerMaxRam(s) - this.ns.getServerUsedRam(s)) / ram_per_thread);
      if (server_available_threads < 1) {
        continue;
      }
      available_runners.push({server: s, threads: server_available_threads});
      total_available_threads += server_available_threads;
    }

    return {available_runners, available_threads: total_available_threads};
  }

  private async exec(script: string, hostname: string, threads_or_options: number | RunOptions, ...args: ScriptArg[]): Promise<number> {
    if (!this.ns.fileExists(script, hostname)) {
      this.ns.scp(script, hostname, 'home');
    }
    return this.ns.exec(script, hostname, threads_or_options, ...args);
  }

  private async _allocateThreads(script: string, threads: number, cumulative = false, maximize_if_fragmented = false, allow_avoided_servers = false, ...args: ScriptArg[]): Promise<[number, number[]]> {
    const servers = await find_servers(this.ns);
    let { available_runners, available_threads } = await this.find_runners(servers, script);
    // If we're not allowed to use avoided servers, remove them from the list
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
