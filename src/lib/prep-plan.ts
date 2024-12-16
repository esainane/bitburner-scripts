import { NS } from '@ns'

export interface PrepPlan {
  grow_duration: number;
  grow_threads: number;
  weaken_1st_threads: number;
  weaken_duration: number;
  weaken_2nd_threads: number;
  wanted: number;
}

export async function calc_max_prep(ns: NS, target: string, available_threads: number): Promise<PrepPlan> {
  let grow_cap = Infinity;
  const cores = 1;
  const grow_duration = ns.getGrowTime(target);
  const weaken_duration = ns.getWeakenTime(target);
  const starting_security = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
  const weaken_security_decrease_per_thread = ns.weakenAnalyze(1, cores);
  let wanted = 0;
  while (grow_cap > 0) {
    // Work out how much is needed to fully weaken the target
    const weaken_1st_threads = Math.ceil(starting_security / weaken_security_decrease_per_thread);
    // Work out how much is needed to fully grow the target
    const growth_required = ns.getServerMaxMoney(target) / ns.getServerMoneyAvailable(target);
    const grow_threads = Math.min(grow_cap, Math.ceil(ns.growthAnalyze(target, growth_required, cores)));
    if (wanted == 0) {
      wanted = grow_threads;
    }
    const growth_security_increase = ns.growthAnalyzeSecurity(grow_threads, undefined, cores);
    // Work out how much is needed to fully weaken the target again
    const weaken_2nd_threads = Math.ceil(growth_security_increase / weaken_security_decrease_per_thread);
    if (weaken_1st_threads + grow_threads + weaken_2nd_threads > available_threads) {
      grow_cap = grow_threads - 1;
      continue;
    }
    return {grow_duration, grow_threads, weaken_1st_threads, weaken_duration, weaken_2nd_threads, wanted};
  }
  return {grow_duration, grow_threads: 0, weaken_1st_threads: available_threads, weaken_duration, weaken_2nd_threads: 0, wanted};
}
