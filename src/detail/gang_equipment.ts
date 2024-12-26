import { NS } from '@ns'
import { format_number, format_servername } from '/lib/colors';
import { currency_format } from '/lib/format-money';

export async function main(ns: NS): Promise<void> {
  ns.gang.getEquipmentNames().forEach(element => {
    ns.tprint(`${element} (${ns.gang.getEquipmentType(element)}) ${currency_format(ns.gang.getEquipmentCost(element))}: ${JSON.stringify(ns.gang.getEquipmentStats(element))}`);
  });
}
