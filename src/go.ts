
const exclude_runners: Set<string> = new Set(["home"]); 

// Tolerance for script drift in ms
const tolerance = 1000;

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
  server: Server;
}

async function plan_schedule(ns: NS, server: Server, threads_available: number) {
  const cores = 1;
  // Analyze a server's hack intervals, effects, and create a timetable to the configured tolerance
  const hack_stolen_per_thread = ns.hackAnalyze(server.hostname);
  // Approximate based on current value - need formulas API for proper calculations here
  const success_rate = ns.hackAnalyzeChance(server.hostname);
  //
  const hack_duration = ns.getHackTime(server.hostname);

  const weaken_security_decrease_per_thread = ns.weakenAnalyze(1, cores);
  const weaken_duration = ns.getWeakenTime(server.hostname);

  // Varies: Increases with security level, decreases with player hacking level
  // Need formulas API to determine duration at always-fully-weakened levels
  const grow_duration = ns.getGrowTime(server.hostname);

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
    if (hack_stolen > 0.3) {
      // Infeasible in practice, here be lumpy numbers
      hack_threads -= 1;
      break;
    }
    const growth_required = 1/(1-hack_stolen);
    //ns.tprint("For: ", server, " want to see ", growth_required, " growth");
    const grow_threads = Math.ceil(ns.growthAnalyze(server.hostname, growth_required, cores));
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

    const success_payout = (server.moneyMax ?? 0) * hack_stolen;

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

async function find_servers(ns: NS) {
  // Traverse the network
  const seen: Set<string> = new Set();
  const home: Server = ns.getServer('home')
  const to_visit: Array<Server> = [home];
  while (to_visit.length > 0) {
    const s: Server = to_visit.pop()!;
    if (seen.has(s.hostname)) {
      continue;
    }
    seen.add(s.hostname);
    for (const adj_name of ns.scan(s.hostname)) {
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push(ns.getServer(adj_name));
    }
  }

  // Work out which servers we can use to run scripts on
  const servers: Array<Server> = [...seen.values()].map(ns.getServer);
  return servers;
}

interface Runner {server:Server, threads:number}

interface RunnersData {
  available_runners: Array<Runner>;
  available_threads: number;
}

async function find_runners(ns: NS, servers: Array<Server>) {
  const available_runners: Array<Runner> = [];
  let total_available_threads = 0;

  const ram_per_thread = ns.getScriptRam('grow1.ts', 
  'home');

  for (const s of servers) {
    if (!s.hasAdminRights) {
      continue;
    }
    if (exclude_runners.has(s.hostname)) {
      continue;
    }
    const server_available_threads = Math.floor((s.maxRam - s.ramUsed) / ram_per_thread);
    if (server_available_threads < 1) {
      continue;
    }
    available_runners.push({server: s, threads: server_available_threads});
    total_available_threads += server_available_threads;
  }

  available_runners.sort((l, r) =>
    l.threads - r.threads
  );

  return {available_runners, total_available_threads};
}

async function find_best_plan(ns: NS, servers: Array<Server>, available_threads: number) {
  // Work out which server is the best to target
  let best;
  for (const s of servers) {
    const candidate = await plan_schedule(ns, s, available_threads);
    if (!candidate) {
      continue;
    }
    if (!best) {
      best = candidate;
      continue;
    }
    const fitness = (p: PlanData) => p.success_payout * p.success_rate / p.execution_duration;
    if (fitness(best) < fitness(candidate)) {
      best = candidate;
    }
  }
  return best;
}

export async function main(ns: NS): Promise<void> {
  while (true) {
    const servers = await find_servers(ns);
    const runners = await find_runners(ns, servers);
    const best = await find_best_plan(ns, ns.args.length > 0 ? [ns.getServer(String(ns.args[0]))] : servers, runners.total_available_threads / splits);
    if (!best) {
      ns.tprint("Could not devise any feasible plan!");
      return;
    }
    // Report result
    ns.tprint(`Want to, against ${best.server.hostname}:`)
    ns.tprint(` After ${best.hack_delay}ms, start a hack with ${best.hack_threads} threads`);
    ns.tprint(` After ${best.weaken_1st_delay}ms, start a weaken with ${best.weaken_1st_threads} threads`);
    ns.tprint(` After ${best.grow_delay}ms, start a grow with ${best.grow_threads} threads`);
    ns.tprint(` After ${best.weaken_2nd_delay}ms, start a weaken with ${best.weaken_2nd_threads} threads`);
    ns.tprint(` Then repeat the process after ${best.execution_duration}ms. This earns ${best.success_payout} ${best.success_rate * 100}% of the time, and uses ${best.hack_threads + best.weaken_1st_threads + best.weaken_2nd_threads + best.grow_threads} out of ${runners.total_available_threads} available threads.`);

    const plan_hacking_level = ns.getPlayer().skills.hacking;
    do {
      const { available_runners, total_available_threads } = await find_runners(ns, await find_servers(ns));
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
            }
          }
          const to_use = Math.min(amount, current_runner.threads - current_runner_threads_used);
          if (to_use < 1) {
            ns.tprint(
              "Attempting to use less than one thread on a runner, this shouldn't happen! Amount: ", amount,
              ", current runner: ", current_runner.server.hostname, ", threads:", current_runner.threads, ", current runner used:", current_runner_threads_used
            );
            ns.exit();
          }
          if (!ns.fileExists(script, current_runner.server.hostname)) {
            ns.scp(script, current_runner.server.hostname, 'home');
          }
          ns.tprint('exec(', script, ', ', current_runner.server.hostname, ', ', to_use, ', ', args.join(', '), '; using ', to_use, ' with ', current_runner_threads_used, '/', current_runner.threads, ' used');
          ns.exec(script, current_runner.server.hostname, to_use, ...args);
          amount -= to_use;
          current_runner_threads_used += to_use;
        }
      };
      // This assumes threads can be broked up aacross multiple instances. I don't think this is the case,
      // as the increase in security from one hack/grow will reduce the effect of those which follow.
      // As grow significantly increases security and is difficult to recover from if something goes wrong,
      // it gets top priority on unfragmented allocations. Hack follows, and then the weakens. It's possible
      // that the weakens should be prioritized above the hack.
      allocate_threads(best.grow_threads, 'grow1.ts', best.server.hostname, best.grow_delay);
      allocate_threads(best.hack_threads, 'hack1.ts', best.server.hostname, best.hack_delay);
      allocate_threads(best.weaken_2nd_threads, 'weak1.ts', best.server.hostname, best.weaken_2nd_delay);
      allocate_threads(best.weaken_1st_threads, 'weak1.ts', best.server.hostname, best.weaken_1st_delay);

      // Wait until this block finishes, then see if state has changed/needs recalculating.
      // Otherwise, just run it again.
      await ns.sleep(best.execution_duration / splits);

    } while (plan_hacking_level == ns.getPlayer().skills.hacking);

    ns.tprint(`Player skill level changed (${plan_hacking_level} -> ${ns.getPlayer().skills.hacking}), recalculating autohack...`);
  }
}