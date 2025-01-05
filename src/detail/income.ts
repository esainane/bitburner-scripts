import { MoneySource, NS } from '@ns'
import { colors, format_servername, print_table } from '/lib/colors';
import { currency_format } from '/lib/format-money';
import { get_stock_info } from '/wse';
import { money_per_hash } from '/hacknet';

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

function print_sources(ns: NS, sources: MoneySource): void {
  print_table(ns, (ns: NS) => {
    for (const [k, v] of Object.entries(sources).filter(([k, v]) => v !== 0).sort(([k1, v1], [k2, v2]) => v1 - v2)) {
      const stored: number = get_stored(ns, k);
      ns.tprintf("%s: %s%s%s%s%s",
        k === "total" ? `${colors.fg_cyan}total${colors.reset}` : format_servername(k),
        currency_format(v),
        stored ? ` (${currency_format(stored)}` : '',
        stored ? ' stored, ' : '',
        stored ? currency_format(v + stored) : '',
        stored ? ' net)' : '',
      );
    }
  });
}

export async function main(ns: NS): Promise<void> {
  // XXX: If getMoneySource().total is always the player's current money, perhaps ths could be used as a more RAM
  // friendly way of retrieving money when a script needs to get the player's current money, and nothing else.
  const { sinceStart: since_last_bitnode, sinceInstall: since_last_aug } = ns.getMoneySources();
  ns.tprint("Since last BitNode:");
  print_sources(ns, since_last_bitnode);
  ns.tprint("Since last augmentation:");
  print_sources(ns, since_last_aug);
}
