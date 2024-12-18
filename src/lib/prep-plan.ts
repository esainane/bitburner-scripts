import { NS } from '@ns'

export interface PrepPlan {
  grow_duration: number;
  grow_threads: number;
  weaken_1st_threads: number;
  weaken_duration: number;
  weaken_2nd_threads: number;
  wanted: number;
}

export async function calc_max_prep(ns: NS, target: string, available_threads: number, grow_cap = Infinity): Promise<PrepPlan> {
  if (available_threads > 0 && grow_cap < 1) {
    ns.tprint("Something very strange happened - there must be at least one server with a thread available to say there are positive available threads: calc_max_prep(ns, ", target, ", ", available_threads, ", ", grow_cap, ")");
  }
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
  // Work how many grow threads are needed ideally
  // FIXME: This uses the current player skill and server security values, whereas in practice the server will
  // have been weakened by the weaken amount. This means we could (and likely will) be overgrowing compared to
  // what is required. This does not break the process, but it does mean we could be needlessly expending resources.
  // This can be optimized by using ns.formulas when available.
  const wanted_grow_threads = Math.ceil(ns.growthAnalyze(target, growth_required, cores));
  if (available_threads <= 0) {
    // Don't immediately fail, as we sometimes want to know the wanted value. However, we can still avoid the loop.
    return {grow_duration, grow_threads: 0, weaken_1st_threads: 0, weaken_duration, weaken_2nd_threads: 0, wanted: wanted_grow_threads };
  }
  if (available_threads <= weaken_1st_threads) {
    // No resources to grow the NPC, but we can weaken it
    return {grow_duration, grow_threads: 0, weaken_1st_threads: available_threads, weaken_duration, weaken_2nd_threads: 0, wanted: wanted_grow_threads};
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
    return {grow_duration, grow_threads: grow_threads, weaken_1st_threads, weaken_duration, weaken_2nd_threads, wanted: wanted_grow_threads };
  }
  return {grow_duration, grow_threads: 0, weaken_1st_threads, weaken_duration, weaken_2nd_threads: 0, wanted: wanted_grow_threads };
}
