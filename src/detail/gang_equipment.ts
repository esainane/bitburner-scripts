import { NS } from '@ns'
import { format_number, format_servername } from '/lib/colors';
import { format_currency } from '/lib/format-money';

export async function main(ns: NS): Promise<void> {
  ns.gang.getEquipmentNames().forEach(element => {
    ns.tprint(`${element} (${ns.gang.getEquipmentType(element)}) ${format_currency(ns.gang.getEquipmentCost(element))}: ${JSON.stringify(ns.gang.getEquipmentStats(element))}`);
  });
}
