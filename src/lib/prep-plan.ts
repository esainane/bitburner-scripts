import { NS } from '@ns'
import { as_normalized } from './as-normalized';

export interface PrepPlan {
  grow_duration: number;
  grow_threads: number;
  grow_effect: number;
  weaken_1st_threads: number;
  weaken_duration: number;
  weaken_2nd_threads: number;
  wanted: number;
}

export async function calc_max_prep(ns: NS, target: string, available_threads: number, grow_cap = Infinity): Promise<PrepPlan> {
  if (available_threads > 0 && grow_cap < 1) {
    ns.tprint("Something very strange happened - there must be at least one server with a thread available to say there are positive available threads: calc_max_prep(ns, ", target, ", ", available_threads, ", ", grow_cap, ")");
  }
  const forumlas_api_available = ns.fileExists('Formulas.exe', 'home');
  const cores = 1;
  const grow_duration = ns.getGrowTime(target);
  const weaken_duration = ns.getWeakenTime(target);
  const min_security = ns.getServerMinSecurityLevel(target);
  const current_security = ns.getServerSecurityLevel(target);
  const excess_security = current_security - min_security;
  const weaken_security_decrease_per_thread = ns.weakenAnalyze(1, cores);
  // Work out how much is needed to fully weaken the target
  const weaken_1st_threads = Math.ceil(excess_security / weaken_security_decrease_per_thread);
  // Work out how much is needed to fully grow the target
  const growth_required = ns.getServerMaxMoney(target) / ns.getServerMoneyAvailable(target);
  // Work how many grow threads are needed
  // If the formulas API is available, we can use it to get an exact solution using the post-weakened server stats.
  // Otherwise, we'll use the current server and player status, which can overestimate what is required.
  // This is fine for normalization, though it can be wasteful, especially as it increases the number of weaken
  // threads required in the second weaken.
  const wanted_grow_threads = forumlas_api_available
    ? Math.ceil(ns.formulas.hacking.growThreads(as_normalized(ns, target), ns.getPlayer(), growth_required, cores))
    : Math.ceil(ns.growthAnalyze(target, growth_required, cores));
  if (available_threads <= 0) {
    // Don't immediately fail, as we sometimes want to know the wanted value. However, we can still avoid the loop.
    return {grow_duration, grow_threads: 0, weaken_1st_threads: 0, weaken_duration, weaken_2nd_threads: 0, wanted: wanted_grow_threads, grow_effect: 1 };
  }
  if (available_threads <= weaken_1st_threads) {
    // No resources to grow the NPC, but we can weaken it
    return {grow_duration, grow_threads: 0, weaken_1st_threads: available_threads, weaken_duration, weaken_2nd_threads: 0, wanted: wanted_grow_threads, grow_effect: 1};
  }
  grow_cap = Math.min(grow_cap, available_threads - weaken_1st_threads);
  while (grow_cap > 0) {
    const grow_threads = Math.min(grow_cap, wanted_grow_threads);
    const growth_security_increase = ns.growthAnalyzeSecurity(grow_threads, undefined, cores);
    // Work out how much is needed to fully weaken the target again
    const weaken_2nd_threads = Math.ceil(growth_security_increase / weaken_security_decrease_per_thread);
    // We will only grow a server if we can also immediately weaken it again; otherwise, we'll save the resources,
    // as grow increases security by a lot, and we get can very ridiculous task durations very quickly if we don't
    // make sure we always clean up after ourselves
    if (weaken_1st_threads + grow_threads + weaken_2nd_threads > available_threads) {
      grow_cap = grow_threads - 1;
      continue;
    }
    if (grow_threads == wanted_grow_threads) {
      // If we got everything we wanted, our growth is going to be everything we required
      return { grow_duration, grow_threads, weaken_1st_threads, weaken_duration, weaken_2nd_threads, wanted: wanted_grow_threads, grow_effect: growth_required };
    }
    // Otherwise, work out how much we've managed to grow, here
    let grow_effect;
    if (forumlas_api_available) {
      // If the formulas API is available, we have an exact solution
      grow_effect = ns.formulas.hacking.growPercent(as_normalized(ns, target), grow_threads, ns.getPlayer(), cores);
    } else {
      // If not, well, we're going to have to poll a few times. Make sure the final result is exact or an underestimate.
      // Binary search to find how much the selected number of threads will grow the server by
      let [ lower, upper ] = [ 1, growth_required ];
      let [ lower_threads, upper_threads ] = [ 0, wanted_grow_threads ];
      // Guess a starting pivot using the number of threads out of the number of wanted threads as a heuristic
      let pivot = Math.floor(lower + (upper - lower) * (grow_threads / wanted_grow_threads));
      for (const iter of Array(10)) {
        const pivot_threads = ns.growthAnalyze(target, pivot, cores);
        if (pivot_threads < grow_threads) {
          lower = pivot;
          lower_threads = pivot_threads;
        } else {
          upper = pivot;
          upper_threads = pivot_threads;
        }
        // After the first iteration, pick the halfway point rather than trying to interpolate.
        // The interpolation heuristic isn't *that* reliable - we're looking at an exponential function.
        pivot = Math.floor(lower + (upper - lower) / 2);

        if (pivot_threads == grow_threads) {
          lower = upper = pivot;
          break;
        }
      }
      // We want to make sure we're not overestimating the growth effect, so we'll use the lower bound
      grow_effect = lower;
    }
    return {grow_duration, grow_threads, weaken_1st_threads, weaken_duration, weaken_2nd_threads, wanted: wanted_grow_threads, grow_effect };
  }
  return {grow_duration, grow_threads: 0, weaken_1st_threads, weaken_duration, weaken_2nd_threads: 0, wanted: wanted_grow_threads, grow_effect: 1 };
}
