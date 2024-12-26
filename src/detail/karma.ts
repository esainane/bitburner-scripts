import { NS } from '@ns'
import { format_number } from '/lib/colors';

export async function main(ns: NS): Promise<void> {
  ns.tprint('Karma: ', format_number(ns.heart.break(), { round: 2 }));
}
