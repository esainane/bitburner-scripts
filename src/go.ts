import { AutocompleteData, NS, Player } from '@ns'
import { find_servers } from 'lib/find-servers';
import { PriorityQueue } from 'lib/priority-queue';
import { ThreadAllocator } from 'lib/thread-allocator';
import { find_runners, RunnersData } from '/lib/find-runners';

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
const gap = 1000;
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

function plan_schedule(ns: NS, server: string, cycle_time: number, threads_available: number): PlanData | null {
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
    // Relaive to the end of the HWGW block
    const hack_start = -hack_duration - 4 * gap;
    const weaken_1st_start = -weaken_duration - 3 * gap;
    const grow_start = -grow_duration - 2 * gap;
    const weaken_2nd_start = -weaken_duration - 1 * gap;

    // Relative to the start of the HWGW *launch*
    const hack_delay = hack_start + cycle_time;
    const weaken_1st_delay = weaken_1st_start + cycle_time;
    const grow_delay = grow_start + cycle_time;
    const weaken_2nd_delay = weaken_2nd_start + cycle_time;

    const execution_duration = cycle_time;

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

const plan_fitness = (p: PlanData) => p.success_payout * p.success_rate / p.execution_duration;

function same_basis(a: Player, b: Player): boolean {
  // Not just hacking skill; these can change from simple IPvGO bonuses
  return a.skills.hacking === b.skills.hacking &&
    a.mults.hacking === b.mults.hacking &&
    a.mults.hacking_chance === b.mults.hacking_chance &&
    a.mults.hacking_grow === b.mults.hacking_grow &&
    // Hacking money multiplier does affect the % hacked, so must be the same
    a.mults.hacking_money === b.mults.hacking_money &&
    a.mults.hacking_speed === b.mults.hacking_speed;
}

function format_player_basis(a: Player): string {
  return `H: ${a.skills.hacking} HM: ${a.mults.hacking} HC: ${a.mults.hacking_chance} HG: ${a.mults.hacking_grow} H$: ${a.mults.hacking_money} HS: ${a.mults.hacking_speed}`;
}

function is_server_normalized(ns: NS, server: string): boolean {
  return ns.getServerMoneyAvailable(server) === ns.getServerMaxMoney(server) &&
    ns.getServerSecurityLevel(server) === ns.getServerMinSecurityLevel(server);
}

function find_best_split(ns: NS, server: string, available_threads: number): CycleData | null {
  // Fail fast: If we can't actually hack the server, we can't do anything
  if (ns.getServerRequiredHackingLevel(server) > ns.getHackingLevel()) {
    return null;
  }
  // Fail fast: If we can't hack less than the maximum proportion of the server's money, we can't do anything
  const hack_stolen_per_thread = ns.hackAnalyze(server);
  if (hack_stolen_per_thread > hack_limit) {
    return null;
  }
  // Fail fast: If the NPC isn't normalized, we can't do anything (yet)
  if (!is_server_normalized(ns, server)) {
    return null;
  }
  // XXX: These all depend on the server being normalized at the time of calculation
  const weak_time = ns.getWeakenTime(server);
  const grow_time = ns.getGrowTime(server);
  const hack_time = ns.getHackTime(server);
  const base_cycle_time = Math.max(hack_time + 4 * gap, weak_time + 3 * gap, grow_time + 2 * gap);
  // Artifically pad the cycle time so that blocks starting every 4 seconds won't end up between a security increasing
  // task finishing and the weaken which normalizes it
  // Without padding, this means: 0 < (base_cycle % 2) < 1
  // With padding, we want to aim for 0 + tolerace < (base_cycle % 2) < 1 - tolerance
  // Tolerance is 25% of the gap. Check with HWGWBlock to make sure tolerance > precision, with some margin
  const tolerance = gap / 4;
  const base_cycle_time_offset = base_cycle_time % 2;
  let cycle_padding = 0;
  if (base_cycle_time_offset < tolerance) {
    cycle_padding += tolerance - base_cycle_time_offset;
  } else if (base_cycle_time_offset > 1 - tolerance) {
    cycle_padding += 2 - base_cycle_time_offset + tolerance;
  }
  const cycle_time = base_cycle_time + cycle_padding;

  // Now that we know how long a cycle is, determine the maximum number of times it can be split into 4s wide
  // reservation blocks
  const max_blocks = Math.floor(cycle_time / (4 * gap));
  // Then optimize the number of blocks for the optimal payoff
  // Thread numbers can be quite chunky, so often we will want to have fewer blocks with more threads
  let best: CycleData | null = null;
  for (let blocks = max_blocks; blocks > 0; --blocks) {
    const block_threads = Math.floor(available_threads / blocks);
    const candidate = plan_schedule(ns, server, cycle_time, block_threads);
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
  const sorter = (a: PlanData, b: PlanData) => plan_fitness(a) - plan_fitness(b);

  // Keep persistent track of when the last running block on each server finishes.
  const block_finishes: Map<string, number> = new Map();
  // Also keep track of when the next normalized section is for analysis
  const next_normalized: Map<string, number> = new Map();
  const dirty = new Set<string>();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Find the best plan for each target NPC server
    const servers: Array<string> = ns.args.length > 0 ? [String(ns.args[0])] : await find_servers(ns);
    // TODO: Use thread allocator to find available runners
    const runners: RunnersData = await find_runners(ns, servers, 'worker/grow1.js');
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

    // Save the player's stats at this point, we'll need to replan if this changes
    const plan_basis = ns.getPlayer();
    // Store a distinct queue for blocks. If we change plans, this will be discarded
    const blockQueue = new PriorityQueue<ScheduledTask>((a, b) => a.startTime - b.startTime);

    // Work out how many threads will be used for each server, allocating threads to each plan in order of expected
    // revenue per second decreasing, continuing if there are threads left over until we either run out of allocatable
    // threads or targetable NPC servers

    const selected_plans = [];
    let remaining_threads = runners.available_threads;
    for (const plan of plans) {
      const threads_required = plan.hack_threads + plan.weaken_1st_threads + plan.grow_threads + plan.weaken_2nd_threads;
      if (threads_required < remaining_threads) {
        // Maybe a less lucrative plan can still use these threads
        continue;
      }
      selected_plans.push(plan);
      remaining_threads -= threads_required;
    }

    // For each selected server, make sure there is an entry for when the blocks finish
    // Initialized to 0 for now
    for (const plan of selected_plans) {
      if (!block_finishes.has(plan.server)) {
        block_finishes.set(plan.server, 0);
      }
    }

    // NB: Keikaku means plan
    let keikaku_doori = true;

    // Queue up HWGW blocks for each selected plan
    for (const plan of selected_plans) {
      // Start from when the last block finished, or when a block started no would finish, whatever is later
      const now_would_finish = Date.now() + plan.execution_duration;
      const server_next_slot_start = Math.max(now_would_finish - 4 * gap, block_finishes.get(plan.server) ?? 0);
      for (const block_offset of Array(plan.blocks).keys()) {
        let block_start = server_next_slot_start + block_offset * 4 * gap;
        const schedule_block = async () => {
          // Schedule tasks for the current one...
          const allocator = new ThreadAllocator(ns, exclude_runners, avoid_runners).allocateThreads;
          if (!is_server_normalized(ns, plan.server)) {
            // Something has not gone according to plan
            ns.tprint(`Server ${plan.server} is not normalized, something did not go according to plan. Restarting planner`);
            dirty.add(plan.server);
            keikaku_doori = false;
            return;
          }
          // Good to go, allocate threads for this block
          const [unallocable_h, pids_h] = await allocator('worker/hack1.js', plan.hack_threads, true, plan.server, plan.hack_delay);
          const [unallocable_w1, pids_w1] = await allocator('worker/weaken1.js', plan.weaken_1st_threads, true, plan.server, plan.weaken_1st_delay);
          const [unallocable_g, pids_g] = await allocator('worker/grow1.js', plan.grow_threads, true, plan.server, plan.grow_delay);
          const [unallocable_w2, pids_w2] = await allocator('worker/weaken1.js', plan.weaken_2nd_threads, true, plan.server, plan.weaken_2nd_delay);
          // Check we actually allocated everything.
          if ([unallocable_h, unallocable_w1, unallocable_g, unallocable_w2].some(d => d > 0)) {
            ns.tprint("Could not allocate all threads for HWGW block, aborting block.");
            for (const pid of [...pids_h, ...pids_w1, ...pids_g, ...pids_w2]) {
              ns.kill(pid);
            }
          } else {
            // OK
            block_finishes.set(plan.server, Date.now() + plan.execution_duration);
          }
          // ...and schedule the next block
          block_start += plan.execution_duration
          blockQueue.push({ callback: schedule_block, startTime: block_start });
        }
        // Start the first block at this block offset. It will schedule another exactly one cycle later, and so on.
        // If the player's hacking skill changes, the blockQueue is discarded (unlike the taskQueue) and replaced
        // with one using the newly optimized set of plans.
        blockQueue.push({ callback: schedule_block, startTime: block_start });
      }
    }

    do {
      const now = Date.now();
      const later = now + 500;

      // Find any servers who can have a new HWGW block assigned
      while (blockQueue.peek()?.startTime ?? later <= now) {
        const task = blockQueue.pop();
        if (!task) continue;

        task.callback();
      }

      const next = blockQueue.peek()?.startTime ?? later;

      // Sleep until the next queued task, but no more than 500ms
      await ns.sleep(Math.max(1, Math.min(next - Date.now(), 500)));
    } while (keikaku_doori && same_basis(plan_basis, ns.getPlayer()));

    ns.tprint(`Effective Player stats changed (${format_player_basis(plan_basis)} -> ${format_player_basis(ns.getPlayer())}), recalculating autohack...`);
  }
}
