import { NS } from '@ns'
import { range } from '/lib/range';
import { format_currency } from '/lib/format-money';
import { format_number, format_servername } from '/lib/colors';

export async function buy_all_sleeve_augs(ns: NS) {
  const available: [number, string, number][] = [];
  for (const sleeve of range(ns.sleeve.getNumSleeves())) {
    for (const {name, cost} of ns.sleeve.getSleevePurchasableAugs(sleeve)) {
      available.push([cost, name, sleeve]);
    }
  }
  available.sort(([a], [b]) => b - a);
  while (available.length > 0) {
    const next = available.pop();
    if (!next) {
      break;
    }
    const [cost, name, sleeve] = next;
    if (ns.sleeve.purchaseSleeveAug(sleeve, name)) {
      ns.tprint(`Purchased ${format_servername(name)} for ${format_currency(cost)} on sleeve ${format_number(sleeve)}`);
    }
  }
}

export async function main(ns: NS): Promise<void> {
  await buy_all_sleeve_augs(ns);
}
