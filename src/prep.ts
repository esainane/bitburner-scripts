import { AutocompleteData, NS } from '@ns'
import { calc_max_prep } from 'lib/prep-plan';
import { ThreadAllocator } from 'lib/thread-allocator';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.servers];
}

const exclude_runners: Set<string> = new Set([]);//"home"]);
// Tolerance for script drift in ms
const tolerance = 1000;

export async function main(ns: NS): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const allocator = new ThreadAllocator(ns, exclude_runners, new Set());
    const available_threads = allocator.availableThreads();
    const target = String(ns.args[0]);

    const {grow_duration, grow_threads, weaken_1st_threads, weaken_duration, weaken_2nd_threads, wanted} = calc_max_prep(ns, target, available_threads);

    const weaken_1st_start = -weaken_duration - 3 * tolerance;
    const grow_start = -grow_duration - 2 * tolerance;
    const weaken_2nd_start = -weaken_duration - 1 * tolerance;
    // Naive block-out calculation
    const reservation_start = Math.min(
      ...(weaken_1st_threads ? [weaken_1st_start] : []),
      grow_start,
      weaken_2nd_start, // never this, but included for clarity
    );
    const weaken_1st_delay = weaken_1st_start - reservation_start;
    const grow_delay = grow_start - reservation_start;
    const weaken_2nd_delay = weaken_2nd_start - reservation_start;

    const execution_duration = -reservation_start;

    // Report result
    ns.tprint(`Want to, against ${target}:`)
    if (weaken_1st_threads) {
      ns.tprint(` After ${weaken_1st_delay}ms, start a weaken with ${weaken_1st_threads} threads`);
    }
    if (grow_threads) {
      ns.tprint(` After ${grow_delay}ms, start a grow with ${grow_threads} threads`, ...(wanted == grow_threads ? [] : [" (THROTTLED, wanted ", wanted, " threads)"]));
    }
    if (weaken_2nd_threads) {
      ns.tprint(` After ${weaken_2nd_delay}ms, start a weaken with ${weaken_2nd_threads} threads`);
    }
    ns.tprint(` This process completes after ${execution_duration}ms.`);

    // This assumes threads can be broken up across multiple instances. This is the case for weaken, but not grow.
    await allocator.allocateThreads('worker/weak1.js', weaken_1st_threads, true, target, weaken_1st_delay);
    await allocator.allocateThreads('worker/grow.js', grow_threads, false, target, grow_delay);
    await allocator.allocateThreads('worker/weak1.js', weaken_2nd_threads, true, target, weaken_2nd_delay);


    // Wait until this block finishes, then see if state has changed/needs recalculating.
    // Otherwise, just run it again.
    await ns.sleep(execution_duration);
    if (wanted != grow_threads) {
      ns.tprint('Prep was throttled due to insufficient threads: ', grow_threads, '/', wanted, ' were available. Continuing...')
      continue;
    }
    ns.tprint("Finished preparing ", target, '.');
    break;
  }
}
