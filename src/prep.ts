import { AutocompleteData, NS, ScriptArg } from '@ns'
import { find_servers } from 'lib/find-servers';
import { find_runners } from 'lib/find-runners';
import { calc_max_prep } from 'lib/prep-plan';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.servers];
}

const exclude_runners: Set<string> = new Set([]);//"home"]);
// Tolerance for script drift in ms
const tolerance = 1000;

interface Runner { server: string, threads: number }

export async function main(ns: NS): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { available_runners, available_threads } = await find_runners(ns, await find_servers(ns), 'worker/grow1.ts', exclude_runners);
    const target = String(ns.args[0]);

    const {grow_duration, grow_threads, weaken_1st_threads, weaken_duration, weaken_2nd_threads, wanted} = await calc_max_prep(ns, target, available_threads);

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

    let current_runner: Runner | undefined;
    let current_runner_threads_used = 0;
    const allocate_threads = (amount: number, script: string, ...args: ScriptArg[]) => {
      while (amount > 0) {
        if (!current_runner || current_runner.threads - current_runner_threads_used < 1) {
          current_runner = available_runners.pop();
          current_runner_threads_used = 0;
          if (!current_runner) {
            ns.tprint("Failed to allocate threads, this shouldn't happen!");
            ns.exit();
            // Silence warnings
            return;
          }
        }
        const to_use = Math.min(amount, current_runner.threads - current_runner_threads_used);
        if (to_use < 1) {
          ns.tprint(
            "Attempting to use less than one thread on a runner, this shouldn't happen! Amount: ", amount,
            ", current runner: ", current_runner.server, ", threads:", current_runner.threads, ", current runner used:", current_runner_threads_used
          );
          ns.exit();
        }
        if (!ns.fileExists(script, current_runner.server)) {
          ns.scp(script, current_runner.server, 'home');
        }
        ns.tprint('exec(', script, ', ', current_runner.server, ', ', to_use, ', ', args.join(', '), '; using ', to_use, ' with ', current_runner_threads_used, '/', current_runner.threads, ' used');
        ns.exec(script, current_runner.server, to_use, ...args);
        amount -= to_use;
        current_runner_threads_used += to_use;
      }
    };
    // This assumes threads can be broken up across multiple instances. This is the case for weaken, but not grow.
    allocate_threads(grow_threads, 'worker/grow1.ts', target, grow_delay);
    allocate_threads(weaken_2nd_threads, 'worker/weak1.ts', target, weaken_2nd_delay);
    if (weaken_1st_threads) {
      allocate_threads(weaken_1st_threads, 'worker/weak1.ts', target, weaken_1st_delay);
    }

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
