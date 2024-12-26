import { NS } from '@ns'
import { format_number } from '/lib/colors';

export async function main(ns: NS): Promise<void> {
  ns.tprint(`getSharePower() -> ${format_number(ns.getSharePower(), {round: 2})}`);
}
