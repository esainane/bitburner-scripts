import { NS, ScriptArg } from '@ns'

// This was written before I realized ns.hack, ns.weaken, ns.grow all took a parameter to wait beforehand
// It might still be useful if I later want to optimize very long delays for hack and weaken where ns.share
// can be run in the meantime... but given that everything is nicely aligned now, that too might be easier to
// simply extend the existing functions to handle.

/**
 * HWGWBlock: Core class for managing a block of hack, weaken, grow, weaken.
 *
 * This class represents a single block of hack, weaken, grow, weaken, on a given server, finishing within a specified
 * window (with a gap of 1s between the end of each task, the window is 4s).
 * Once assigned, this window is considered immutable: There will be tasks finishing at the designated points in the
 * window, even if the player's hacking skill level increases.
 *
 * To handle changes in external state, two key callbacks must be provided to a HWGWBlock:
 * - `queue_task(callback: () => Promise<void>, startTime: number) => void`:
 *   This function will be called to queue a callback to be called at a specified timestamp.
 * - `thread_allocator(script: string, threads: number, cumulative: boolean) => Promise<[number, number[]]>`:
 *   This function will be called to allocate a number of threads for a script.
 *   If the cumulative property is set, the threads can be split over many instances with the same effect;
 *   otherwise, the threads must be allocated to a single running script instance.
 *
 * If an increase to a player's skill level would cause a task to finish faster than expected, the task will be
 * rescheduled to still finish at the expected time.
 * If for any reason a player will not be able to cause a task to be able to finish in time, then the block will be
 * aborted, and all running scripts started from this block will be killed.
 * If resource constraints mean that all requested threads for a weaken or grow could not be allocated, then the grow
 * and hack tasks will have the number of threads reduced to a level which will produce the final steady state (fully
 * weakened, full money).
 * If an increase to a player's skill level would cause even a single thread to hack more than the permissable
 * proportion of money from an NPC, then the block will be aborted, and all running scripts started from this block
 * will be killed.
 */

export class HWGWBlock {
  constructor(
    private ns: NS,
    /// Host to target
    private target: string,
    /// Time when the first task should be finishing
    private block_start: number,
    /// Task queuer to defer a supplied task until later
    private queue_task: (callback: () => Promise<void>, startTime: number) => void,
    //< Threads to use for the hack. May be less to stay under the hack limit/weak1 amount/grow recovery
    private hack_threads: number,
    /// Threads to use for the first weaken
    private weak1_threads: number,
    /// Threads to use for the grow. May be less to stay under the weak2 amount
    private grow_threads: number,
    /// Threads to use for the second weaken
    private weak2_threads: number,
    /// Allocator to use to attempt to allocate a number of threads for a script
    private thread_allocator: (script: string, threads: number, cumulative: boolean, ...args: ScriptArg[]) => Promise<[number, number[]]>,
    /// How much of a gap to leave between the end of a given activity and the next:
    /// between hack and weaken, weaken and grow, grow and the second weaken; between the last weaken of this block and the hack of the next block
    private gap: number = 1000,
    /// How much we can tolerate activity end time drift before we abort the block, in either direction
    /// Default is 20% of the gap
    private precision: number = gap / 5,
    /// Function to retrieve current time. Mockable for testing.
    private now: () => number = () => Date.now(),
  ) {
    this.ns = ns;
    this.target = target;
    this.block_start = block_start;
    this.queue_task = queue_task;

    this.thread_allocator = thread_allocator;

    this.gap = gap;
    this.precision = precision;

    this.weak1_threads = weak1_threads;
    this.hack_threads = hack_threads;
    this.weak2_threads = weak2_threads;
    this.grow_threads = grow_threads;

    this.now = now;

    queue_task(this.startHack, this.hack_start());
    queue_task(this.startWeak1, this.weak1_start());
    queue_task(this.startGrow, this.grow_start());
    queue_task(this.startWeak2, this.weak2_start());
  }

  private hack_pid = 0;
  private weak1_security: number | undefined; //< Total security decrease for the first weaken
  private weak1_pids: Array<number> = [];
  private grow_pid = 0;
  private weak2_security: number | undefined; //< Total security decrease for the second weaken
  private weak2_pids: Array<number> = [];

  private aborted = false;

  private hack_start = () => this.hack_finish() - this.ns.getHackTime(this.target);
  private weak1_start = () => this.weak1_finish() - this.ns.getWeakenTime(this.target);
  private grow_start = () => this.grow_finish() - this.ns.getGrowTime(this.target);
  private weak2_start = () => this.weak2_finish() - this.ns.getWeakenTime(this.target);

  private hack_finish = () => this.block_start;
  private weak1_finish = () => this.block_start + this.gap;
  private grow_finish = () => this.block_start + 2 * this.gap;
  private weak2_finish = () => this.block_start + 3 * this.gap;

  public async abort() {
    this.aborted = true;
    for (const weak1_pid of this.weak1_pids) {
      this.ns.kill(weak1_pid);
    }
    if (this.hack_pid) {
      this.ns.kill(this.hack_pid);
    }
    for (const weak2_pid of this.weak2_pids) {
      this.ns.kill(weak2_pid);
    }
    if (this.grow_pid) {
      this.ns.kill(this.grow_pid);
    }
  }

  public async startHack() {
    if (this.aborted) return;
    // Check whether we can start the hack.
    // 1. We want the hack to end within one tenth of our configured tolerance gap to the intended end time.
    // 2. We want to make sure the security increase does not exceed what will be weakened by the first weaken.
    // 3. We want to make sure that we do not hack more than will be regrown.
    // If (1), reschedule for when the shortened time would complete at our target time.
    // If (2) or (3), reduce the number of threads used until neither hold, potentially skipping the hack entirely.

    const cores = 1; // TODO: One day, maybe

    // We're about to immediately fire a hack, so check what the actual duration would be,
    // based on the current status of player and server
    const hack_duration = this.ns.getHackTime(this.target);
    const delta = this.hack_finish() - this.now() - hack_duration;
    // (1)
    if (Math.abs(delta) > this.precision) {
      // Reschedule
      if (delta < 0) {
        // Somehow, we're taking more time than we should
        this.ns.tprint("Hack is taking too long compared to expected! This shouldn't happen!");
        return await this.abort();
      }
      // We got faster, wait a little longer to compensate
      return this.queue_task(this.startHack, this.hack_finish() - hack_duration);
    }

    // (2)
    if (this.weak1_security === undefined) {
      throw new Error("Expected weak1 to be running before hack!");
    }
    let actual_hack_threads = this.hack_threads;
    do {
      // Does not depend on security level, so fine (and ideal) to use here
      const security_increase = this.ns.hackAnalyzeSecurity(this.hack_threads);
      if (security_increase < this.weak1_security) {
        break;
      }
      // Reduce the number of threads used
      --actual_hack_threads;
    } while (actual_hack_threads > 0);
    if (actual_hack_threads < 1) {
      // We can't hack at all, abort
      return await this.abort();
    }

    // (3)
    if (this.grow_pid === 0) {
      throw new Error("Expected grow to be running before hack!");
    }
    // FIXME: hackAnalyze depends on current status of player and server
    // This is calculated at the end, when we know it's fully weakened, so we should be checking "ideal" values
    const hack_stolen_per_thread = this.ns.hackAnalyze(this.target);
    let growth_threads_required: number;
    do {
      // FIXME: Depends on current status of player and server
      // Similarly, this is calculated at the end of the grow, so we should be checking "ideal" values
      growth_threads_required = this.ns.growthAnalyze(this.target, 1/(1 - actual_hack_threads * hack_stolen_per_thread), cores);
      if (growth_threads_required <= this.grow_threads) {
        break;
      }
      --actual_hack_threads;
    } while (actual_hack_threads > 0);

    if (actual_hack_threads < 1) {
      // We can't hack at all, abort
      return await this.abort();
    }

    // Start the hack
    await this._startHack(actual_hack_threads);
  }

  private async _startHack(threads: number, extra_delay: number) {
    // Immediately spawn a hacking process, without checks
    const [unallocatable_threads, pids] = await this.thread_allocator('worker/hack1.ts', threads, false);
    if (unallocatable_threads == threads) {
      // We can't hack at all, abort
      return await this.abort();
    }
    if (unallocatable_threads > 0) {
      this.ns.tprint("Using less hack threads than desired toward ", this.target, ", ", unallocatable_threads, "/", threads, " threads were unallocatable.");
    }
    if (pids.length > 1) {
      this.abort();
      throw new Error("More than one PID allocated for hack, this shouldn't happen!");
    }
    this.hack_pid = pids[0];
  }

  public async startWeak1() {
    if (this.aborted) return;
    // Check whether we can start the first weaken.
    // Weaken calls are cumulative, so we can distribute these very easily.
    // We want to make sure the weaken completes within one tenth of our configured tolerance gap to the intended end time.
    // If not, reschedule for when the shortened time would complete at our target time.

    // We're about to immediately fire a weaken, so check what the actual duration would be,
    // based on the current status of player and server
    const weaken_duration = this.ns.getWeakenTime(this.target);
    const delta = this.weak1_finish() - this.now() - weaken_duration;
    if (Math.abs(delta) > this.precision) {
      // Reschedule
      if (delta < 0) {
        // Somehow, we're taking more time than we should
        this.ns.tprint("First weaken is taking too long compared to expected! This shouldn't happen!");
        return await this.abort();
      }
      // We got faster, wait a little longer to compensate
      return this.queue_task(this.startWeak1, this.weak1_finish() - weaken_duration);
    }

    // Start the weaken
    await this._startWeak1();
  }

  private async _startWeak1(extra_delay: number) {
    // Immediately spawn a weakening process, without checks
    const [unallocatable_threads, pids] = await this.thread_allocator('worker/weak1.ts', this.weak1_threads, true);
    if (unallocatable_threads == this.weak1_threads) {
      // We couldn't weaken at all, abort
      return await this.abort();
    }
    if (unallocatable_threads > 0) {
      this.ns.tprint("Using less weaken threads than desired toward ", this.target, ", ", unallocatable_threads, "/", this.weak1_threads, " threads were unallocatable.");
      this.weak1_threads -= unallocatable_threads;
    }
    this.weak1_security = this.ns.weakenAnalyze(this.weak1_threads);
    this.weak1_pids = pids;
  }

  public async startGrow() {
    if (this.aborted) return;
    // Check whether we can start the grow.
    // 1. We want the grow to end within one tenth of our configured tolerance gap to the intended end time.
    // 2. We want to make sure the security increase does not exceed what will be weakened by the first weaken.
    // If (1), reschedule for when the shortened time would complete at our target time.
    // If (2), reduce the number of threads used until this is not the case, or we abort.

    // (1)
    // We're about to immediately fire a grow, so check what the actual duration would be,
    // based on the current status of player and server
    const grow_duration = this.ns.getGrowTime(this.target);
    const delta = this.grow_finish() - this.now() - grow_duration;
    if (Math.abs(delta) > this.precision) {
      // Reschedule
      if (delta < 0) {
        // Somehow, we're taking more time than we should
        this.ns.tprint("Grow is taking too long compared to expected! This shouldn't happen!");
        return await this.abort();
      }
      // We got faster, wait a little longer to compensate
      return this.queue_task(this.startGrow, this.grow_finish() - grow_duration);
    }

    // (2)
    if (this.weak2_security === undefined) {
      throw new Error("Expected weak2 to be running before grow!");
    }
    let actual_grow_threads = this.grow_threads;
    do {
      // This does not depend on server security level, so fine (and ideal) to use here
      const security_increase = this.ns.growthAnalyzeSecurity(this.grow_threads);
      if (security_increase < this.weak2_security) {
        break;
      }
      // Reduce the number of threads used
      --actual_grow_threads;
    } while (actual_grow_threads > 0);
    if (actual_grow_threads < 1) {
      // We can't grow at all, abort
      return await this.abort();
    }

    // Start the grow
    await this._startGrow(actual_grow_threads);
  }

  private async _startGrow(threads: number, extra_delay: 0) {
    // Immediately spawn a growing process, without checks
    const [unallocatable_threads, pids] = await this.thread_allocator('worker/grow1.ts', threads, false);
    if (unallocatable_threads == threads) {
      // We can't grow at all, abort
      return await this.abort();
    }
    if (unallocatable_threads > 0) {
      this.ns.tprint("Using less grow threads than desired toward ", this.target, ", ", unallocatable_threads, "/", threads, " threads were unallocatable.");
    }
    this.grow_threads -= unallocatable_threads;
    if (pids.length > 1) {
      this.abort();
      throw new Error("More than one PID allocated for grow, this shouldn't happen!");
    }
    this.grow_pid = pids[0];
  }

  public async startWeak2() {
    if (this.aborted) return;
    // Check whether we can start the second weaken.
    // Weaken calls are cumulative, so we can distribute these very easily.
    // We want to make sure the weaken completes within one tenth of our configured tolerance gap to the intended end time.
    // If not, reschedule for when the shortened time would complete at our target time.

    // We're about to immediately fire a weaken, so check what the actual duration would be,
    // based on the current status of player and server
    // About 50% of the time, this should be slightly slower than expected, given the HWGW cycle is waiting for a
    // weaken to normalize after a security-increasing task 50% of the time
    const weaken_duration = this.ns.getWeakenTime(this.target);
    const delta = this.weak2_finish() - this.now() - weaken_duration;
    if (Math.abs(delta) > this.precision) {
      // Reschedule
      if (delta < 0) {
        // Somehow, we're taking more time than we should
        this.ns.tprint("Second weaken is taking too long compared to expected! This shouldn't happen!");
        return await this.abort();
      }
      // We got faster, wait a little longer to compensate
      return this.queue_task(this.startWeak2, this.weak2_finish() - weaken_duration);
    }

    // Start the weaken
    await this._startWeak2();
  }

  private async _startWeak2(extra_delay: number) {
    // Immediately spawn a weakening process, without checks
    const [unallocatable_threads, pids] = await this.thread_allocator('worker/weak1.ts', this.weak2_threads, true);
    if (unallocatable_threads == this.weak2_threads) {
      // We couldn't weaken at all, abort
      return await this.abort();
    }
    if (unallocatable_threads > 0) {
      this.ns.tprint("Using less weaken threads than desired toward ", this.target, ", ", unallocatable_threads, "/", this.weak2_threads, " threads were unallocatable.");
      this.weak2_threads -= unallocatable_threads;
    }
    this.weak2_security = this.ns.weakenAnalyze(this.weak2_threads);
    this.weak2_pids = pids;
  }
}


export async function main(ns: NS): Promise<void> {
  //
}
