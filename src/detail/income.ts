import { MoneySource, NS } from '@ns'
import { colors, format_servername, print_table } from '/lib/colors';
import { format_currency } from '/lib/format-money';
import { get_stock_info } from '/wse';
import { money_per_hash } from '/hacknet';

type LineItem = {
  name: string;
  net: number;
  stored: number;
  gain: number;
  cost: number;
}

function get_stored(ns: NS, source: string): number {
  switch (source) {
    case 'stock':
      return get_stock_info(ns, false).reduce((acc, { long, bid_price, short, ask_price }) => acc + long * bid_price + short * ask_price, 0);
    case 'hacknet':
      return money_per_hash * ns.hacknet.numHashes();
    default:
      return 0;
  }
}

function combine_cost(ns: NS, name: string, v: number, sources: MoneySource, cost_item: string): LineItem {
  const cost = Object.assign(Object(), sources)[cost_item] ?? 0;
  const stored = get_stored(ns, name) ?? 0;
  return { name, net: v + stored + cost, stored, gain: Math.max(0, v), cost: Math.min(0, v) + cost };
}

function get_line_item(ns: NS, name: string, v: number, sources: MoneySource): LineItem | null {
  switch (name) {
    // Combine costs and gains from closely related entries
    // gang expenses are pretty clear cut.
    case 'gang':
      return combine_cost(ns, name, v, sources, 'gang_expenses');
    // Server costs and hacknet expenses are a little murkier.
    // 'servers' includes home upgrades, which are usually used for general purpose scripts.
    // However, the vast majority of this category should be server expenses for HWGW autohacking.
    case 'hacking':
      return combine_cost(ns, name, v, sources, 'servers');
    // Similarly, once hacknet servers are available, they can be used like servers.
    // However, we try to avoid running scripts on them, since hashes are valuable and script RAM usage decreases
    // hash production while active. It's technically possible for hacknet expenses to be made just for even more
    // servers, but this is unlikely.
    case 'hacknet':
      return combine_cost(ns, name, v, sources, 'hacknet_expenses');
    // ...and remove the closely related entries
    case 'gang_expenses':
    case 'servers':
    case 'hacknet_expenses':
      return null;
    default: {
      const stored = get_stored(ns, name) ?? 0;
      return { name, net: v + stored, stored, gain: Math.max(0, v), cost: Math.min(0, v) };
    }
  }
}

function print_sources(ns: NS, sources: MoneySource): void {
  const data: LineItem[] = Object.entries(sources).map(([k, v]) => get_line_item(ns, k, v, sources))
    .filter(v => v !== null)
    .sort(({net: lnet}, {net: rnet}) => lnet - rnet);
  print_table(ns, (ns: NS) => {
    for (const {name, net, stored, gain, cost} of data) {
      const distinct_gain = gain !== 0 && gain !== net;
      const distinct_cost = cost !== 0 && cost !== net;
      if (!distinct_gain && !distinct_cost && !stored && !net) {
        continue;
      }
      ns.tprintf("%s: %s%s%s%s%s%s%s%s",
        name === "total" ? `${colors.fg_cyan}total${colors.reset}` : format_servername(name),
        format_currency(net),
        distinct_gain || distinct_cost || stored ? ` net` : '',
        stored ? ` (${format_currency(stored)}` : '',
        stored ? ' stored) ' : '',
        distinct_gain ? format_currency(gain) : '',
        distinct_gain ? ' gain' : '',
        distinct_cost ? ` ${format_currency(cost)}` : '',
        distinct_cost ? ' cost' : '',
      );
    }
  });
}

export async function main(ns: NS): Promise<void> {
  // XXX: If getMoneySource().total is always the player's current money, perhaps ths could be used as a more RAM
  // friendly way of retrieving money when a script needs to get the player's current money, and nothing else.
  const { sinceStart: since_last_bitnode, sinceInstall: since_last_aug } = ns.getMoneySources();
  const { lastAugReset: last_aug_reset, lastNodeReset: last_node_reset } = ns.getResetInfo();
  if (last_aug_reset !== last_node_reset) {
    ns.tprint("Since last BitNode:");
    print_sources(ns, since_last_bitnode);
    ns.tprint("Since last augmentation:");
  }
  print_sources(ns, since_last_aug);
}
