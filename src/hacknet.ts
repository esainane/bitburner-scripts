import { NS } from '@ns'
import { currency_format } from '/lib/format-money';
import { format_number } from '/lib/colors';
import { range } from '/lib/range';
import { format_duration } from '/lib/format-duration';

export function autocomplete(data: string[], args: string[]): string[] {
  return ['--no-sell', '--no-buy'];
}

const money_per_hash = 1e6 / 4;

export async function main(ns: NS): Promise<void> {
  const do_sell = !ns.args.includes('--no-sell');
  const do_buy = !ns.args.includes('--no-buy');
  // Greedy algorithm go!
  // Work out the step with the greatest cost efficiency available, and make it, if possible.
  // If the best move cannot be afforded yet, sleep and retry later.
  interface Action {
    cb: () => void;
    cost: number;
    hash_gain_delta: number;
    description: string;
  }
  let announced = false;
  let batched = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (do_sell) {
      // HN Server payoff, simple approach: Just sell all hashes for money for now
      const hashes = ns.hacknet.numHashes();
      for (const i of range(Math.floor(hashes / 4))) {
        ns.hacknet.spendHashes('Sell for Money');
      }
    }

    if (!do_buy) {
      await ns.asleep(3000);
      continue;
    }

    // Then, work out what the most cost-efficient upgrade is, and do that.
    const player_mult = ns.getPlayer().mults.hacknet_node_money;
    const nodes = ns.hacknet.numNodes();
    let best: Action | null = null;
    if (nodes < ns.hacknet.maxNumNodes()) {
      const money_gain_delta = ns.formulas.hacknetServers.hashGainRate(1, 0, 1, 1, player_mult);
      const cost = ns.hacknet.getPurchaseNodeCost();
      best = {
        cost: cost,
        hash_gain_delta: money_gain_delta,
        cb: () => ns.hacknet.purchaseNode(),
        description: `Purchase new node for ${currency_format(cost)}`
      }
    }
    const add_candidate: (c: Action) => void = (c: Action) => {
      if (best == null) {
        best = c;
        return;
      }
      if (best.hash_gain_delta / best.cost < c.hash_gain_delta / c.cost) {
        best = c;
      }
    }
    for (let idx=0; idx < nodes; ++idx) {
      const stats = ns.hacknet.getNodeStats(idx);
      const current_rate = ns.formulas.hacknetServers.hashGainRate(stats.level, 0, stats.ram, stats.cores, player_mult);
      add_candidate({
        cost: ns.hacknet.getLevelUpgradeCost(idx),
        hash_gain_delta: ns.formulas.hacknetServers.hashGainRate(stats.level + 1, 0, stats.ram, stats.cores, player_mult) - current_rate,
        cb: () => ns.hacknet.upgradeLevel(idx),
        description: `Upgrade node ${format_number(idx)} to level ${format_number(stats.level + 1)}`
      });
      add_candidate({
        cost: ns.hacknet.getRamUpgradeCost(idx),
        hash_gain_delta: ns.formulas.hacknetServers.hashGainRate(stats.level, 0, stats.ram * 2, stats.cores, player_mult) - current_rate,
        cb: () => ns.hacknet.upgradeRam(idx),
        description: `Upgrade node ${format_number(idx)} RAM to ${format_number(stats.ram * 2)}GB`
      });
      add_candidate({
        cost: ns.hacknet.getCoreUpgradeCost(idx),
        hash_gain_delta: ns.formulas.hacknetServers.hashGainRate(stats.level, 0, stats.ram, stats.cores + 1, player_mult) - current_rate,
        cb: () => ns.hacknet.upgradeCore(idx),
        description: `Upgrade node ${format_number(idx)} cores to ${format_number(stats.cores + 1)}`
      });
    }

    // If we have an action to take, and we can afford it, take it.
    if (best && best.cost < ns.getPlayer().money) {
      best.cb();
      // If we haven't announced this specific action, add it to the count of batched actions for when we do announce.
      if (!announced) {
        ++batched;
      }
      announced = false;
      continue;
    }
    // If we have nothing further to do, exit.
    if (!best) {
      ns.tprint("All hacknet node upgrades purchased, exiting script.");
      break;
    }
    // We need to wait for more money to come in before we can afford the best action.
    // Mention what we did, what we want to do, and then wait.
    if (!announced) {
      if (batched > 0) {
        ns.tprint(`(Performed a total of ${format_number(batched)} hacknet upgrades with available money.)`);
        batched = 0;
      }
      ns.tprint(`Waiting for more money for the best action: ${best.description} for +${format_number(best.hash_gain_delta, { round: 5 })} h/s (+${currency_format(best.hash_gain_delta * money_per_hash)}/s), costing ${currency_format(best.cost)} (repaid in ${format_duration(best.cost / (best.hash_gain_delta * money_per_hash) * 1000)}).`);
      announced = true;
    }
    await ns.sleep(3000);
  }
}
