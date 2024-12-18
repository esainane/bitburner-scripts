import { AutocompleteData, NS, Player, ProcessInfo } from '@ns'
import { find_servers } from 'lib/find-servers';
import { PriorityQueue } from 'lib/priority-queue';
import { ThreadAllocator } from 'lib/thread-allocator';
import { find_runners, RunnersData } from 'lib/find-runners';
import { calc_max_prep } from 'lib/prep-plan';
import { currency_format } from 'lib/format-money';
import { format_duration } from 'lib/format-duration';
import { colors, format_number } from 'lib/colors';
import { format_servername } from 'lib/colors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.servers, '--quiet'];
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
    //ns.log("INFO For: ", server, " want to see ", growth_required, " growth");
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

// Expected value per thread per second (for one block)
const value_per_thread_per_second = (p: PlanData) => p.success_payout * p.success_rate * 1000 / p.execution_duration / plan_threads_required_per_block(p);

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

function format_mult_to_percent(a: number): string {
  return `${format_number(Math.floor(10000 * (a - 1)) / 100)}${colors.fg_cyan}%${colors.reset}`;
}

function format_player_basis(a: Player): string {
  return `H: ${format_number(a.skills.hacking)} HM: ${format_mult_to_percent(a.mults.hacking)} HC: ${format_mult_to_percent(a.mults.hacking_chance)} HG: ${format_mult_to_percent(a.mults.hacking_grow)} H$: ${format_mult_to_percent(a.mults.hacking_money)} HS: ${format_mult_to_percent(a.mults.hacking_speed)}`;
}

function is_server_normalized(ns: NS, server: string): boolean {
  return ns.getServerMoneyAvailable(server) === ns.getServerMaxMoney(server) &&
    ns.getServerSecurityLevel(server) === ns.getServerMinSecurityLevel(server);
}

function plan_threads_required_per_block(p: PlanData): number {
  return p.hack_threads + p.weaken_1st_threads + p.grow_threads + p.weaken_2nd_threads;
}

function cycle_threads_required_for_all_blocks(p: CycleData): number {
  return p.blocks * plan_threads_required_per_block(p);
}

function format_normalize_state(ns: NS, server: string): string {
  const server_fullness_percent = Math.floor(100 * ns.getServerMoneyAvailable(server) / ns.getServerMaxMoney(server));
  const server_min_security = ns.getServerMinSecurityLevel(server);
  const server_security_excess = Math.floor(1000 * (ns.getServerSecurityLevel(server) - server_min_security)) / 1000;
  return `{${format_number(server_fullness_percent)}${colors.fg_cyan}%${colors.reset} @ ${server_min_security}${ server_security_excess ? `${colors.fg_red}+${format_number(server_security_excess)}` : ''}`;
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
    if (value_per_thread_per_second(best) < value_per_thread_per_second(candidate)) {
      best = { blocks, ...candidate };
    }
  }
  return best;
}

interface ScheduledTask {
  callback: () => Promise<void>;
  startTime: number;
}

const state_file = "data/go-state.json";

export async function main(real_ns: NS): Promise<void> {
  const ns = { ...real_ns, log: real_ns.args.indexOf('--quiet') !== -1 ? real_ns.print : real_ns.tprint };

  // Sort by value descending
  const value_per_thread_per_second_descending = (l: PlanData, r: PlanData) => value_per_thread_per_second(r) - value_per_thread_per_second(l);

  // Silence noisy and uninteresting functions
  ns.disableLog('ALL');
  if (real_ns.args.indexOf('--quiet') === -1) {
    ns.enableLog('exec');
    ns.enableLog('scp');
  }

  // Keep persistent track of when the last running block on each server finishes.
  const block_finishes: Map<string, number> = new Map();
  // Also keep track of when the next normalized section is for analysis
  const next_normalized: Map<string, number> = new Map();
  const dirty = new Set<string>();

  // Dump state when killed
  ns.atExit(() => {
    ns.write(state_file, JSON.stringify({
      block_finishes: [...block_finishes.entries()],
      next_normalized: [...next_normalized.entries()],
      dirty: [...dirty]
    }), 'w');
  }, "Serialize state");

  // Load state on startup, unless we are passed a "--noload"
  if (ns.fileExists(state_file) && ns.args.indexOf("--noload") === -1) {
    const data = ns.read(state_file);
    if (data) {
      const j_data = JSON.parse(data);
      for (const [k, v] of j_data.block_finishes) {
        block_finishes.set(k, v);
      }
      for (const [k, v] of j_data.next_normalized) {
        next_normalized.set(k, v);
      }
      for (const d of j_data.dirty) {
        dirty.add(d);
      }
    }
  }

  const p_args = ns.args.map(String).filter(d => !d.startsWith('-'));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Find the best plan for each target NPC server
    const all_servers: Array<string> = p_args.length > 0 ? p_args : find_servers(ns);
    const runners: RunnersData = find_runners(
      ns, all_servers, 'worker/grow1.js', exclude_runners,
      (process: ProcessInfo) => ['worker/grow1.js', 'worker/hack1.js', 'worker/weak1.js'].indexOf(process.filename) !== -1
    );
    const all_available_threads = runners.available_threads;

    const targeted_servers: Array<string> = (p_args.length > 0 ? p_args : all_servers).filter(s => ns.getServerRequiredHackingLevel(s) <= ns.getPlayer().skills.hacking && ns.getServerMaxMoney(s) > 0);
    // Split up all servers into those which are normalized and those which are not
    const unprepared_servers: Array<string> = [];
    const servers: Array<string> = [];
    const now = Date.now();
    let normalized_later = 0;
    for (const t of targeted_servers) {
      if (is_server_normalized(ns, t)) {
        servers.push(t);
      } else if (dirty.has(t)) {
        unprepared_servers.push(t);
      } else if ((block_finishes.get(t) ?? 0) > now || (next_normalized.get(t) ?? 0) > now) {
        // If it currently is or later will be normalized, and hasn't been flagged as "something went wrong",
        // treat it as normalized
        servers.push(t);
        ++normalized_later;
      } else {
        unprepared_servers.push(t);
      }
    }
    // Clear the dirty set
    dirty.clear();

    // Sort by required hacking level ascending
    unprepared_servers.sort((l, r) => ns.getServerRequiredHackingLevel(l) - ns.getServerRequiredHackingLevel(r));

    ns.log(`INFO ${format_number(servers.length - normalized_later)}/${format_number(targeted_servers.length)} targetable servers are normalized`, normalized_later === 0 ? '' : `, ${format_number(normalized_later)}/${format_number(targeted_servers.length - servers.length + normalized_later)} are already being fully normalized`, unprepared_servers.length === 0 ? '' : ` ${format_number(unprepared_servers.length)}/${format_number(targeted_servers.length)} are not yet normalized`, '.');

    // Find plans for all normalized targeted servers
    const plans: Array<CycleData> = servers.map(s => find_best_split(ns, s, all_available_threads)).filter(d => d != null).sort(value_per_thread_per_second_descending);
    if (!plans.length) {
      ns.log("WARN Could not devise any feasible plan!");
      if (!unprepared_servers.length) {
        ns.log("ERROR Nothing we can do, terminating.");
        return;
      }
      // ...but we might be able to normalize some to make feasible plans later
    } else {
      // Report result
      ns.log(`INFO Top 3 plans, for ${format_number(all_available_threads)} ${colors.fg_yellow}available threads${colors.reset}:`);
      for (const plan of plans.slice(0, 3)) {
        const ev_pt_ps = value_per_thread_per_second(plan);
        const threads_per_block = plan_threads_required_per_block(plan);
        ns.log(`INFO   ${format_servername(plan.server)}: ${currency_format(Math.floor(ev_pt_ps))} EV $/T/sec (H: ${plan.hack_threads}, W1: ${format_number(plan.weaken_1st_threads)}, G: ${format_number(plan.grow_threads)}, W2: ${format_number(plan.weaken_2nd_threads)}; T: ${format_number(threads_per_block)}) over ${format_duration(plan.execution_duration)}ms, up to ${currency_format(ev_pt_ps * threads_per_block * plan.blocks)} EV $/sec with ${format_number(plan.blocks)} blocks`, (plan.success_rate < 0.999 ? ` (${format_number(Math.floor(plan.success_rate * 100))}${colors.fg_cyan}%${colors.reset} success each block)` : ''));
      }
    }

    // Save the player's stats at this point, we'll need to replan if this changes
    const plan_basis = ns.getPlayer();
    // Store a distinct queue for blocks. If we change plans, this will be discarded
    const blockQueue = new PriorityQueue<ScheduledTask>((a, b) => a.startTime - b.startTime);

    // NB: Keikaku means plan
    let keikaku_doori = true;

    // These will be filled in after we know what's left after normalization allocation
    const selected_plans: Array<CycleData> = [];

    // Are there targetable servers which are not normalized?
    // If so, reserve some of our allocated threads to prepare them for normalization
    let normalization_reserved = 0;
    let normalization_reserved_desc = "";
    if (unprepared_servers.length) {
      // First, if there are no viable plans, allocate all threads to normalization
      if (!plans.length) {
        normalization_reserved = all_available_threads;
        normalization_reserved_desc = " (All threads; no viable plans)";
      } else {
        // Otherwise:
        // If letting the best plan run would leave us with less than 10% of all available threads,
        // reserve them all
        // If letting the best two plans run would leave us with less than 20% of all available threads,
        // let the best plan have what it needs and take the rest
        // Otherwise, take what's left after the two most lucrative plans
        const best_plan = plans[0];
        const best_threads = plan_threads_required_per_block(best_plan);
        if (best_threads > 0.9 * all_available_threads) {
          normalization_reserved = all_available_threads;
          normalization_reserved_desc = " (All threads; best plan uses > 90%)";
        } else if (plans.length == 1) {
          normalization_reserved = all_available_threads - best_threads;
          normalization_reserved_desc = " (Enough threads for the only plan to still run a block)"
        } else {
          const second_best_plan = plans[1];
          const second_best_threads = plan_threads_required_per_block(second_best_plan);
          if (best_threads + second_best_threads > 0.8 * all_available_threads) {
            normalization_reserved = all_available_threads - best_threads;
            normalization_reserved_desc = " (Enough threads for the best plan to still run a block; best two would use > 80%)"
          } else {
            normalization_reserved = all_available_threads - best_threads - second_best_threads;
            normalization_reserved_desc = " (Enough threads for the best two plans to still run a block)";
          }
        }
        if (normalization_reserved !== all_available_threads && all_available_threads > 500 && normalization_reserved > 0.5 * all_available_threads) {
          // If we're not using all available threads for normalization, but we're using more than half, and we have a lot of threads, limit the amount reserved for normalization to half
          // This strikes a reasonable balance between prioritizing normalization early, and harvesting ready NPCs
          normalization_reserved = Math.ceil(all_available_threads / 2);
          normalization_reserved_desc = " (Half of available threads)";
        }
      }
      ns.log(`INFO Reserving ${format_number(normalization_reserved)} threads for normalization${normalization_reserved_desc}`);
      let normalization_used = 0;
      const try_later_delay = 5000;
      let any_throttled_or_incomplete = false;
      // Schedule the normalization procecss
      const schedule_normalize = async () => {
        ns.log("INFO Running normalization.");
        const allocator_instance = new ThreadAllocator(ns, exclude_runners, avoid_runners);
        const allocator = allocator_instance.getAllocator();
        for (const server of unprepared_servers) {
          if (is_server_normalized(ns, server)) {
            // We have a newly normalized server
            unprepared_servers.splice(unprepared_servers.indexOf(server), 1);
            next_normalized.set(server, Date.now());
            block_finishes.set(server, Date.now());
            // Create a plan for it
            const plan = find_best_split(ns, server, normalization_reserved);
            // If it's better than any of the selected plans, trigger a recalculation
            if (plan && (!selected_plans.length || (value_per_thread_per_second(plan) > value_per_thread_per_second(selected_plans[selected_plans.length - 1])))) {
              ns.log("INFO Better plan now available, triggering replanning.");
              keikaku_doori = false;
              return;
            } else {
              ns.log("INFO Server ", format_servername(server), " is now normalized (no improvement on selected plans).");
            }
            continue;
          }
          // If a full normalization for this server is already in progress, skip it
          if ((next_normalized.get(server) ?? 0) > Date.now()) {
            // But don't release our resources yet
            any_throttled_or_incomplete = true;
            continue;
          }
          // Otherwise, we have a server which needs normalizing
          // If we don't have the resources to do anything more, break
          if (normalization_reserved - normalization_used <= 0) {
            ns.log("INFO No more normalization resources available {branch 1}.");
            any_throttled_or_incomplete = true;
            break;
          }
          const largest_block = allocator_instance.largestContiguousBlock();
          if (largest_block === 0) {
            ns.log("INFO No normalization resources available in practice {branch 3}.");
            any_throttled_or_incomplete = true;
            break;
          }
          const prep_plan = await calc_max_prep(ns, server, normalization_reserved - normalization_used, largest_block);
          const prep_duration = Math.max(prep_plan.weaken_duration + 3 * gap, prep_plan.grow_duration + 2 * gap);
          const [unallocable_w1, pids_w1] = await allocator('worker/weak1.js', prep_plan.weaken_1st_threads, true, server, prep_duration - prep_plan.weaken_duration - 3 * gap);
          const [unallocable_g, pids_g] = await allocator('worker/grow1.js', prep_plan.grow_threads, false, server, prep_duration - prep_plan.grow_duration - 2 * gap);
          const [unallocable_w2, pids_w2] = await allocator('worker/weak1.js', prep_plan.weaken_2nd_threads, true, server, prep_duration - prep_plan.weaken_duration - 1 * gap);
          // If allocation failed, kill anything which was allocated and try again later
          if ([unallocable_w1, unallocable_g, unallocable_w2].some(d => d > 0)) {
            ns.log(`INFO Could not allocate all threads for normalization block on ${format_servername(server)} ${format_normalize_state(ns, server)} [W1: ${format_number(prep_plan.weaken_1st_threads - unallocable_w1)}/${format_number(prep_plan.weaken_1st_threads)}, G: ${format_number(prep_plan.grow_threads - unallocable_g)}/${format_number(prep_plan.grow_threads)}, W2: ${format_number(prep_plan.weaken_2nd_threads - unallocable_w2)}/${format_number(prep_plan.weaken_2nd_threads)}], aborting block.`);
            for (const pid of [...pids_w1, ...pids_g, ...pids_w2]) {
              ns.kill(pid);
            }
            any_throttled_or_incomplete = true;
            break;
          } else {
            // OK
            const threads_used = prep_plan.weaken_1st_threads + prep_plan.grow_threads + prep_plan.weaken_2nd_threads;
            const was_throttled = prep_plan.grow_threads !== prep_plan.wanted;
            // Report
            ns.log(`INFO ${colors.fg_cyan}Normalizing${colors.reset} ${format_servername(server)} ${format_normalize_state(ns, server)}: [W1: ${format_number(prep_plan.weaken_1st_threads)}, G: ${format_number(prep_plan.grow_threads)}, W2: ${format_number(prep_plan.weaken_2nd_threads)}; T: ${format_number(threads_used)}] over ${format_duration(prep_duration)}.${(was_throttled) ? ` (${colors.fg_yellow}THROTTLED${colors.reset}, Grow: ${format_number(prep_plan.grow_threads)}/${format_number(prep_plan.wanted)})` : ""}`);
            if (was_throttled) {
              any_throttled_or_incomplete = true;
            } else {
              // If we could do everything we wanted, indicate this NPC will be fully normalized at block end
              next_normalized.set(server, Date.now() + prep_duration);
            }
            // OK
            normalization_used += prep_plan.weaken_1st_threads + prep_plan.grow_threads + prep_plan.weaken_2nd_threads;
            // Once this is done and the relevant threads are available again, check back in and see if more
            // normalization needs to happen
            blockQueue.push({ callback: async () => {
              normalization_used -= prep_plan.weaken_1st_threads + prep_plan.grow_threads + prep_plan.weaken_2nd_threads;
              await schedule_normalize();
            }, startTime: Date.now() + prep_duration });
            if (normalization_reserved - normalization_used <= 0) {
              // No more resources available for normalization at this time
              ns.log("INFO No more normalization resources available {branch 2}.");
              any_throttled_or_incomplete = true;
            break;
            }
          }
        }
        // Schedule ourselves to be run again later if we would otherwise not
        if (normalization_used == 0) {
          blockQueue.push({ callback: schedule_normalize, startTime: Date.now() + try_later_delay });
        }
      }
      await schedule_normalize();
      if (!any_throttled_or_incomplete) {
        // We were able to set everything up to be normalized; reclaim unused threads for main plan operation
        normalization_reserved = normalization_used;
      }
    }

    let available_threads = all_available_threads - normalization_reserved;

    // Work out how many threads will be used for each server, allocating threads to each plan in order of expected
    // revenue per second per thread decreasing, continuing if there are threads left over until we either run out of allocatable
    // threads or targetable NPC servers

    const blocks_per_plan = new Map<string, number>();
    for (const plan of plans) {
      const threads_per_block = plan_threads_required_per_block(plan);
      if (threads_per_block > available_threads) {
        // Maybe a less lucrative plan can still use these threads
        ns.log(`INFO Plan for ${format_servername(plan.server)} needs ${format_number(threads_per_block)} threads per block for up to ${format_number(plan.blocks)} blocks, skipping with ${format_number(available_threads)} available.`);
        continue;
      }
      selected_plans.push(plan);

      // Allocate as many blocks as we can, up to the maximum blocks per cycle or the available threads
      const blocks = Math.min(Math.floor(available_threads / threads_per_block), plan.blocks);
      ns.log(`INFO Plan for ${format_servername(plan.server)} needs ${format_number(threads_per_block)} threads per block, allocating ${format_number(blocks)}/${format_number(plan.blocks)} blocks using ${format_number(threads_per_block * blocks)}/${format_number(available_threads)} threads available for an expected ${currency_format(value_per_thread_per_second(plan) * threads_per_block * blocks)} per second after ${format_duration(plan.execution_duration)}.`);
      available_threads -= threads_per_block * blocks;
      blocks_per_plan.set(plan.server, blocks);
      if (available_threads <= 0) {
        break;
      }
    }

    // For each selected server, make sure there is an entry for when the blocks finish
    // Initialized to 0 for now
    for (const plan of selected_plans) {
      if (!block_finishes.has(plan.server)) {
        block_finishes.set(plan.server, 0);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ns.log(`INFO Selected the top ${format_number(selected_plans.length)} plans for execution, overall expected value per second: ${currency_format(selected_plans.reduce((acc, p) => acc + p.success_payout * p.success_rate / p.execution_duration * 1000 * blocks_per_plan.get(p.server)!, 0))}`);

    // Queue up HWGW blocks for each selected plan
    for (const plan of selected_plans) {
      // Start from when the last block finished, or when a block started now would finish, whatever is later
      // This start slot is relative to when the scripts are started/allocated
      // next_normalized is when the next slot for launching is available
      // block_finishes is when the last block of task ends finishs
      const server_next_slot_start = Math.max(now, next_normalized.get(plan.server) ?? now, (block_finishes.get(plan.server) ?? now) - plan.execution_duration);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const block_offset of Array(blocks_per_plan.get(plan.server)!).keys()) {
        let block_start = server_next_slot_start + block_offset * 4 * gap;
        const schedule_block = async () => {
          // Schedule tasks for the current one...
          const allocator = new ThreadAllocator(ns, exclude_runners, avoid_runners).getAllocator();
          if (!is_server_normalized(ns, plan.server)) {
            // Something has not gone according to plan
            ns.log(`WARN Server ${format_servername(plan.server, { is_warning: true })} is not normalized ${format_normalize_state(ns, plan.server)}, something did not go according to plan. Restarting planner`);
            dirty.add(plan.server);
            keikaku_doori = false;
            return;
          }
          const now = Date.now();
          ns.log(`INFO Starting ${colors.fg_cyan}HWGW${colors.reset} block on ${format_servername(plan.server)}: [H: ${format_number(plan.hack_threads)}, W1: ${format_number(plan.weaken_1st_threads)}, G: ${format_number(plan.grow_threads)}, W2: ${format_number(plan.weaken_2nd_threads)}; T: ${format_number(plan_threads_required_per_block(plan))}] ending in ${format_duration(block_start - now + plan.execution_duration)}`);
          // Good to go, allocate threads for this block
          const [unallocable_h, pids_h] = await allocator('worker/hack1.js', plan.hack_threads, true, plan.server, block_start - now + plan.hack_delay);
          const [unallocable_w1, pids_w1] = await allocator('worker/weak1.js', plan.weaken_1st_threads, true, plan.server, block_start - now + plan.weaken_1st_delay);
          const [unallocable_g, pids_g] = await allocator('worker/grow1.js', plan.grow_threads, true, plan.server, block_start - now + plan.grow_delay);
          const [unallocable_w2, pids_w2] = await allocator('worker/weak1.js', plan.weaken_2nd_threads, true, plan.server, block_start - now + plan.weaken_2nd_delay);
          // Check we actually allocated everything.
          if ([unallocable_h, unallocable_w1, unallocable_g, unallocable_w2].some(d => d > 0)) {
            ns.log("INFO Could not allocate all threads for HWGW block on ", format_servername(plan.server), ", aborting block.");
            for (const pid of [...pids_h, ...pids_w1, ...pids_g, ...pids_w2]) {
              ns.kill(pid);
            }
          } else {
            // OK
            // Mark that there will be variations in security until the time these tasks finish
            block_finishes.set(plan.server, Date.now() + plan.execution_duration);
          }
          // ...and schedule the next block when this cycle finishes.
          // Blocks happening 4*gap after this one will be launched by other iterations of the
          // outer loop `(for (plan of selected_plans))` up to the number of blocks which have been allocated
          block_start += plan.execution_duration;
          blockQueue.push({ callback: schedule_block, startTime: block_start });
          // Indicate that the next block is free at this time, if our next scheduled block does not itself run
          // (perhaps due to the queue beingdropped needing to recalculate after a skill change)
          next_normalized.set(plan.server, block_start);
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
      while ((blockQueue.peek()?.startTime ?? later) <= now) {
        const task = blockQueue.pop();
        if (!task) continue;

        await task.callback();
      }

      const next = blockQueue.peek()?.startTime ?? later;

      // Sleep until the next queued task, but no more than 500ms
      await ns.sleep(Math.max(1, Math.min(next - Date.now(), 500)));
    } while (keikaku_doori && same_basis(plan_basis, ns.getPlayer()));

    if (keikaku_doori) {
      ns.log(`INFO Effective Player stats changed, recalculating autohack:\n  (${format_player_basis(plan_basis)}) ->\n  (${format_player_basis(ns.getPlayer())})`);
    } else {
      ns.log("INFO Replanning due to plan divergence flag");
    }
  }
}
