import { NS } from '@ns'
import { format_number, format_servername } from '/lib/colors';

export async function main(ns: NS): Promise<void> {
  if (!ns.fileExists('Formulas.exe', 'home')) {
    return;
  }
  for (const faction of ns.getPlayer().factions) {
    const current_favor = ns.singularity.getFactionFavor(faction);
    const current_rep = ns.singularity.getFactionRep(faction);
    const rep_to_150 = ns.formulas.reputation.calculateFavorToRep(150) - current_rep - ns.formulas.reputation.calculateFavorToRep(current_favor);
    ns.tprint(`${format_servername(faction)}: ${format_number(current_favor, { round: 2 })} favor, ${format_number(current_rep, { round: 0 })} rep${rep_to_150 > 0 ? `, ${format_number(rep_to_150, { round: 0 })} more rep to ${format_number(150)} favor` : ''}`);
  }
  //ns.tprint(`ns.formulas.reputation.calculateFavorToRep(100) -> ${ns.formulas.reputation.calculateFavorToRep(100)}`);
  //ns.tprint(`ns.formulas.reputation.calculateFavorToRep(150) -> ${ns.formulas.reputation.calculateFavorToRep(150)}`);
  //ns.tprint(`ns.formulas.reputation.calculateRepToFavor(75000) -> ${ns.formulas.reputation.calculateRepToFavor(75000)}`);
}
