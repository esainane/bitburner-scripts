import { AutocompleteData, NS, RunOptions, ScriptArg } from '@ns'
import { find_servers } from 'lib/find-servers';
import { PriorityQueue } from 'lib/priority-queue';
import { HWGWBlock } from 'lib/hwgw-block';
import { ThreadAllocator } from 'lib/thread-allocator';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.servers];
}

// go.ts: Bitburner game autohack script
// This finds all NPC servers and maximises the value extracted from them
// given available runners and the player's hacking skill level.

// Servers which should not be used as runners
const exclude_runners: Set<string> = new Set(["home"]);
// Servers which can be used as runners if and only if there are no non-avoid options
const avoid_runners: Set<string> = new Set(["home"]);
// Tolerance for script drift in ms
const tolerance = 1000;
// Steal no more than this much money per hack
const hack_limit = 0.3;
// How many times we should divide the available threads
const splits = 20;

interface PlanData {
  hack_threads: number;
  hack_delay: number;
  weaken_1st_threads: number;
  weaken_1st_delay: number;
  grow_threads: number;
  grow_delay: number;
  weaken_2nd_threads: number;
  weaken_2nd_delay: number;
  execution_duration: number;
  success_payout: number;
  success_rate: number;
  server: string;
}

interface CycleData extends PlanData {
  blocks: number;
}

function plan_schedule(ns: NS, server: string, threads_available: number): PlanData | null {
  const cores = 1;
  // Analyze a server's hack intervals, effects, and create a timetable to the configured tolerance
  const hack_stolen_per_thread = ns.hackAnalyze(server);
  // Approximate based on current value - need formulas API for proper calculations here
  const success_rate = ns.hackAnalyzeChance(server);
  //
  const hack_duration = ns.getHackTime(server);

  const weaken_security_decrease_per_thread = ns.weakenAnalyze(1, cores);
  const weaken_duration = ns.getWeakenTime(server);

  // Varies: Increases with security level, decreases with player hacking level
  // Need formulas API to determine duration at always-fully-weakened levels
  const grow_duration = ns.getGrowTime(server);

  // Given a server which is fully weakened and fully grown...
  // Calculate the required thread counts to perform one HWGW cycle, leaving the server fully weakened and grown
  let best: PlanData | null = null;
  for (let hack_threads = 1; hack_threads < threads_available; ++hack_threads) {
    // Calculate the security increase caused by this many hack threads
    const hack_security_increase = ns.hackAnalyzeSecurity(hack_threads);
    // Calculate the weaken threads needed to finish just after this to fully weaken it again
    const weaken_1st_threads = Math.ceil(hack_security_increase / weaken_security_decrease_per_thread);
    // Calculate the growth threads needed to fully replenish the server
    const hack_stolen = hack_threads * hack_stolen_per_thread;
    // Check that we've left something we can grow back
    if (hack_stolen > hack_limit) {
      // Infeasible in practice, here be lumpy numbers
      hack_threads -= 1;
      break;
    }
    const growth_required = 1/(1-hack_stolen);
    //ns.tprint("For: ", server, " want to see ", growth_required, " growth");
    const grow_threads = Math.ceil(ns.growthAnalyze(server, growth_required, cores));
    // Calculate the security increase caused by this much growth
    // We avoid passing the server hostname so this isn't capped by being already fully grown right now
    const growth_security_increase = ns.growthAnalyzeSecurity(grow_threads, undefined, cores);
    // Calculate the weaken threads required to finish just after growth to fully weaken it again
    const weaken_2nd_threads = Math.ceil(growth_security_increase / weaken_security_decrease_per_thread);

    // Check that we're under the limit
    if (hack_threads + weaken_1st_threads + grow_threads + weaken_2nd_threads > threads_available) {
      // Infeasible, stop incrementing and revert to the last value
      hack_threads -= 1;
      break;
    }
    const hack_start = -hack_duration - 4 * tolerance;
    const weaken_1st_start = -weaken_duration - 3 * tolerance;
    const grow_start = -grow_duration - 2 * tolerance;
    const weaken_2nd_start = -weaken_duration - 1 * tolerance;
    // Naive block-out calculation
    const reservation_start = Math.min(
      hack_start,
      weaken_1st_start,
      grow_start,
      weaken_2nd_start, // never this, but included for clarity
    );
    const hack_delay = hack_start - reservation_start;
    const weaken_1st_delay = weaken_1st_start - reservation_start;
    const grow_delay = grow_start - reservation_start;
    const weaken_2nd_delay = weaken_2nd_start - reservation_start;

    const execution_duration = -reservation_start;

    const success_payout = (ns.getServerMaxMoney(server) ?? 0) * hack_stolen;

    best = {
      hack_threads, weaken_1st_threads, grow_threads, weaken_2nd_threads,
      hack_delay, weaken_1st_delay, grow_delay, weaken_2nd_delay,
      execution_duration,
      success_rate, success_payout,
      server,
    };
  }

  return best;
}

interface Runner { server: string, threads: number }

interface RunnersData {
  available_runners: Array<Runner>;
  available_threads: number;
}

async function find_runners(ns: NS, servers: Array<string>, script = 'worker/grow1.ts'): Promise<RunnersData> {
  const available_runners: Array<Runner> = [];
  let total_available_threads = 0;

  const ram_per_thread = ns.getScriptRam(script, 'home');

  for (const s of servers) {
    if (!ns.hasRootAccess(s)) {
      continue;
    }
    if (exclude_runners.has(s)) {
      continue;
    }
    const server_available_threads = Math.floor((ns.getServerMaxRam(s) - ns.getServerUsedRam(s)) / ram_per_thread);
    if (server_available_threads < 1) {
      continue;
    }
    available_runners.push({server: s, threads: server_available_threads});
    total_available_threads += server_available_threads;
  }

  return {available_runners, available_threads: total_available_threads};
}

const plan_fitness = (p: PlanData) => p.success_payout * p.success_rate / p.execution_duration;

function find_best_split(ns: NS, server: string, available_threads: number): CycleData | null {
  // Fail fast: If we can't hack less than the maximum proportion of the server's money, we can't do anything
  const hack_stolen_per_thread = ns.hackAnalyze(server);
  if (hack_stolen_per_thread > hack_limit) {
    return null;
  }
  // FIXME: These are dependent on current security levels, which might not be the weakest (they'll be pending a corrective weaken about 50% of the time)
  const weak_time = ns.getWeakenTime(server);
  const grow_time = ns.getGrowTime(server);
  const hack_time = ns.getHackTime(server);
  const cycle_time = Math.max(hack_time + 4 * tolerance, weak_time + 3 * tolerance, grow_time + 2 * tolerance);
  const max_blocks = Math.floor(cycle_time / (4 * tolerance));
  let best: CycleData | null = null;
  for (let blocks = max_blocks; blocks > 0; --blocks) {
    const block_threads = Math.floor(available_threads / blocks);
    const candidate = plan_schedule(ns, server, block_threads);
    if (!candidate) {
      continue;
    }
    if (!best) {
      best = { blocks, ...candidate };
      continue;
    }
    if (plan_fitness(best) < plan_fitness(candidate)) {
      best = { blocks, ...candidate };
    }
  }
  return best;
}

interface ScheduledTask {
  callback: () => Promise<void>;
  startTime: number;
}

export async function main(ns: NS): Promise<void> {
  const taskQueue = new PriorityQueue<ScheduledTask>((a, b) => a.startTime - b.startTime);
  const enqueue = (callback: () => Promise<void>, startTime: number) => taskQueue.push({ callback, startTime });
  const sorter = (a: PlanData, b: PlanData) => plan_fitness(a) - plan_fitness(b);

  const block_finishes: Map<string, Date> = new Map();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const servers: Array<string> = ns.args.length > 0 ? [String(ns.args[0])] : await find_servers(ns);
    const runners: RunnersData = await find_runners(ns, servers);
    // Find the best plan for each target NPC server
    const plans: Array<CycleData> = servers.map(s => find_best_split(ns, s, runners.available_threads / splits)).filter(d=> d != null).sort(sorter);
    if (!plans.length) {
      ns.tprint("Could not devise any feasible plan!");
      return;
    }
    // Report result
    ns.tprint(`Top 3 plans, for ${runners.available_threads} available threads:`);
    for (const plan of plans.slice(0, 3)) {
      ns.tprint(`${plan.server}: ${Math.floor(1000 * plan.success_payout * plan.success_rate / plan.execution_duration)} EV $/sec (H: ${plan.hack_threads}, W1: ${plan.weaken_1st_threads}, G: ${plan.grow_threads}, W2: ${plan.weaken_2nd_threads}; T: ${plan.hack_threads + plan.weaken_1st_threads + plan.grow_threads + plan.weaken_2nd_threads}) over ${Math.floor(plan.execution_duration)}ms in ${plan.blocks} blocks (${Math.floor(plan.success_rate * 100)}% success each block)`);
    }

    ns.alert();

    const plan_hacking_level = ns.getPlayer().skills.hacking;

    const next = new HWGWBlock(
      ns, best.server,
      new Date(Date.now() + best.execution_duration),
      enqueue,
      best.weaken_1st_threads, best.hack_threads, best.weaken_2nd_threads, best.grow_threads,
      new ThreadAllocator(ns, exclude_runners, avoid_runners).allocateThreads
    );

    taskQueue.push({ script: 'worker/grow1.ts', server: best.server, threads: best.grow_threads, startTime: Date.now() + best.grow_delay, args: [best.server, best.grow_delay] });
    taskQueue.push({ script: 'worker/hack1.ts', server: best.server, threads: best.hack_threads, startTime: Date.now() + best.hack_delay, args: [best.server, best.hack_delay] });
    taskQueue.push({ script: 'worker/weak1.ts', server: best.server, threads: best.weaken_2nd_threads, startTime: Date.now() + best.weaken_2nd_delay, args: [best.server, best.weaken_2nd_delay] });
    taskQueue.push({ script: 'worker/weak1.ts', server: best.server, threads: best.weaken_1st_threads, startTime: Date.now() + best.weaken_1st_delay, args: [best.server, best.weaken_1st_delay] });

    do {
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      while (taskQueue.size() > 0 && taskQueue.peek()!.startTime <= now) {
        const task = taskQueue.pop();
        if (!task) continue;

        const { script, server, threads, args } = task;
        const currentRunner = runners.available_runners.find(r => r.threads >= threads);
        if (!currentRunner) {
          ns.tprint("Failed to allocate threads, this shouldn't happen!");
          ns.exit();
        }

        const actualTime = ns.getHackTime(server);
        if (actualTime <= task.startTime - now) {
          if (!ns.fileExists(script, currentRunner.server)) {
            ns.scp(script, currentRunner.server, 'home');
          }
          ns.exec(script, currentRunner.server, threads, ...args);
        } else {
          taskQueue.push({ ...task, startTime: now + actualTime });
        }
      }

      await ns.sleep(100);
    } while (plan_hacking_level == ns.getPlayer().skills.hacking);

    ns.tprint(`Player skill level changed (${plan_hacking_level} -> ${ns.getPlayer().skills.hacking}), recalculating autohack...`);
  }
}
