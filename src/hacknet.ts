import { NS } from '@ns'
import { format_currency } from '/lib/format-money';
import { format_number } from '/lib/colors';
import { range } from '/lib/range';
import { format_duration } from '/lib/format-duration';

export function autocomplete(data: string[], args: string[]): string[] {
  return ['--no-sell', '--no-buy'];
}

export const money_per_hash = 1e6 / 4;

// Cache the result of the lookahead function to avoid recalculating it every tick.
// Cache params are [new_server_cost, player_mults.hacknet_node_money, player_mults.hacknet_node_level_cost, player_mults.hacknet_node_ram_cost, player_mults.hacknet_node_core_cost]
type NewServerLookaheadResult = [[number, number, number, number], number];
let cache_params = [0,0,0,0,0];
let cache_result: NewServerLookaheadResult = [[0,0,0,0],0];

function array_eq<T>(l: T[], r: T[]): boolean {
  return l.length === r.length && l.every((v, i) => v === r[i]);
}

function new_server_lookahead(ns: NS): NewServerLookaheadResult {
  // New servers incur an exponentially scaling up-front cost, but often have a better payoff gradient if you can
  // look ahead a few upgrades.

  // This functions determines the tuple (levels, ram, cores) which maximises the cost efficiency of a new server.

  // Properly, this is an Integer Linear Program, but we can get a "good enough" greedy solution by considering the
  // cost efficiency of each upgrade in isolation.

  // This function is pure with respect to these parameters:
  const new_server_cost = ns.hacknet.getPurchaseNodeCost();
  const player_mults = ns.getPlayer().mults;

  // So if they haven't changed, return the cached result
  if (array_eq(cache_params, [new_server_cost, player_mults.hacknet_node_money, player_mults.hacknet_node_level_cost, player_mults.hacknet_node_ram_cost, player_mults.hacknet_node_core_cost])) {
    return cache_result;
  }

  // Track state of the best upgrade found so far. This tuple represents the number of ugprades, not the new value.
  let best: [number, number, number, number] = [0, 0, 0, new_server_cost];
  let best_hash_per_cost = ns.formulas.hacknetServers.hashGainRate(1, 0, 1, 1, player_mults.hacknet_node_money) / new_server_cost;

  const add_candidate = (levels: number, ram: number, cores: number, cost: number) => {
    const hash_gain_rate = ns.formulas.hacknetServers.hashGainRate(1 + levels, 0, 2 ** ram, 1 + cores, player_mults.hacknet_node_money);
    const hash_per_cost = hash_gain_rate / cost;
    if (hash_per_cost > best_hash_per_cost) {
      best = [levels, ram, cores, cost];
      best_hash_per_cost = hash_per_cost;
      return true;
    }
    return false;
  }

  // Simulate repeatedly buying upgrades until the overall gradient no longer improves
  let improvement = true;
  while (improvement) {
    improvement = false;
    const [levels, ram, cores, cost] = best;
    improvement ||= add_candidate(levels + 1, ram, cores, cost + ns.formulas.hacknetServers.levelUpgradeCost(levels + 1, levels + 2, player_mults.hacknet_node_level_cost));
    improvement ||= add_candidate(levels, ram + 1, cores, cost + ns.formulas.hacknetServers.ramUpgradeCost(2 ** ram, 2 ** (ram + 1), player_mults.hacknet_node_ram_cost));
    improvement ||= add_candidate(levels, ram, cores + 1, cost + ns.formulas.hacknetServers.coreUpgradeCost(cores + 1, cores + 2, player_mults.hacknet_node_core_cost));
  }

  // Update the cache
  cache_params = [new_server_cost, player_mults.hacknet_node_money, player_mults.hacknet_node_level_cost, player_mults.hacknet_node_ram_cost, player_mults.hacknet_node_core_cost];
  cache_result = [best, best_hash_per_cost];

  return [best, best_hash_per_cost];
}

export async function main(ns: NS): Promise<void> {
  const do_sell = !ns.args.includes('--no-sell');
  const do_buy = !ns.args.includes('--no-buy');
  // Greedy algorithm go!
  // Work out the step with the greatest cost efficiency available, and make it, if possible.
  // If the best move cannot be afforded yet, sleep and retry later.
  // TODO: This could be improved by determining if any cheap upgrades would pay for themselves in the time it takes to
  // afford the highest ROI upgrade. This is a bit complicated, as we're unlikely to be the only earner, and we also
  // make things other than money (and the first few coding contracts can easily outperform constant money purchase),
  // but it would be nice to have the option.
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
      const hash_gain_delta = ns.formulas.hacknetServers.hashGainRate(1, 0, 1, 1, player_mult);
      const cost = ns.hacknet.getPurchaseNodeCost();
      if (nodes === 0) {
        // If we don't have any existing nodes, don't overcomplicate the calculations
        best = {
          cost: cost,
          hash_gain_delta,
          cb: () => ns.hacknet.purchaseNode(),
          description: `Purchase new node for ${format_currency(cost)}`
        }
      } else {
        // If we do have any existing nodes, look ahead in case delayed gratification would pay off
        const [upgrade, hash_per_cost] = new_server_lookahead(ns);
        best = {
          cost,
          hash_gain_delta: hash_per_cost * upgrade[3],
          cb: () => ns.hacknet.purchaseNode(),
          description: `Purchase new node for ${format_currency(cost)}, looking ahead to performance at [${upgrade[0]} levels, ${upgrade[1]}GB RAM, ${upgrade[2]} cores] for ${format_currency(upgrade[3])}`
        }
      }
    }
    // Then, examine the effect of each available single upgrade for every existing node
    const add_candidate: (c: Action) => void = (c: Action) => {
      if (best == null) {
        best = c;
        return;
      }
      if (best.hash_gain_delta / best.cost < c.hash_gain_delta / c.cost) {
        best = c;
      }
    }
    for (const idx of range(nodes)) {
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
      ns.tprint(`Waiting for more money for the best action: ${best.description} for +${format_number(best.hash_gain_delta, { round: 5 })} h/s (+${format_currency(best.hash_gain_delta * money_per_hash)}/s), costing ${format_currency(best.cost)} (repaid in ${format_duration(best.cost / (best.hash_gain_delta * money_per_hash) * 1000)}).`);
      announced = true;
    }
    await ns.sleep(3000);
  }
}
