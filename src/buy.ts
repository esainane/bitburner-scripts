import { AutocompleteData, NS } from '@ns'
import { currency_format } from 'lib/format-money';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...Array(20).keys().map(d => String(d + 1)), '-f'];
}

export async function main(ns: NS): Promise<void> {
  const spec = Number(ns.args[0])
  ns.tprint(`${2**spec}GB:`, currency_format(ns.getPurchasedServerCost(2**spec)));
  if (ns.args[1] == '-f') {
    ns.purchaseServer(`s-${ns.getPurchasedServers().length}-${spec}`, 2**spec);
  }
  ns.spawn('mass.js', 1);
}
