export async function main(ns: NS): Promise<void> {
  // Greedy algorithm go!
  // Work out the step with the greatest cost efficiency available, and make it, if possible.
  // If the best move cannot be afforded yet, sleep and retry later.
  interface Action {
    cb: () => void;
    cost: number;
    money_gain_delta: number;
  }
  while (true) {
    const nodes = ns.hacknet.numNodes();
    let best: Action | null = null;
    if (nodes < ns.hacknet.maxNumNodes()) {
      const money_gain_delta = ns.formulas.hacknetNodes.moneyGainRate(1, 1, 1);
      const cost = ns.hacknet.getPurchaseNodeCost();
      best = {
        cost: cost,
        money_gain_delta: money_gain_delta,
        cb: () => ns.hacknet.purchaseNode()
      }
    }
    const add_candidate: (c: Action) => void = (c: Action) => {
      if (best == null) {
        best = c;
        return;
      }
      if (best.money_gain_delta / best.cost < c.money_gain_delta / c.cost) {
        best = c;
      }
    }
    for (let idx=0; idx < nodes; ++idx) {
      const stats = ns.hacknet.getNodeStats(idx);
      const current_rate = ns.formulas.hacknetNodes.moneyGainRate(stats.level, stats.ram, stats.cores);
      add_candidate({
        cost: ns.hacknet.getLevelUpgradeCost(idx),
        money_gain_delta: ns.formulas.hacknetNodes.moneyGainRate(stats.level + 1, stats.ram, stats.cores) - current_rate,
        cb: () => ns.hacknet.upgradeLevel(idx)
      });
      add_candidate({
        cost: ns.hacknet.getRamUpgradeCost(idx),
        money_gain_delta: ns.formulas.hacknetNodes.moneyGainRate(stats.level, stats.ram * 2, stats.cores) - current_rate,
        cb: () => ns.hacknet.upgradeRam(idx)
      });
      add_candidate({
        cost: ns.hacknet.getCoreUpgradeCost(idx),
        money_gain_delta: ns.formulas.hacknetNodes.moneyGainRate(stats.level, stats.ram, stats.cores + 1) - current_rate,
        cb: () => ns.hacknet.upgradeCore(idx)
      });
    }
    if (best && best.cost < ns.getPlayer().money) {
      best.cb();
      continue;
    }
    if (!best) {
      ns.tprint("All hacknet node upgrades purchased, exiting script.");
          ns.scp(script, current_runner.server.hostname, 'home');
    }
    await ns.sleep(3000);
  }
}