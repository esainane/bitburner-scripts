import { NS } from '@ns'
import { format_number, format_servername, print_table } from '/lib/colors';

export async function main(ns: NS): Promise<void> {
  if (!ns.fileExists('Formulas.exe', 'home')) {
    return;
  }
  print_table(ns, (ns: NS) => {
    for (const faction of ns.getPlayer().factions) {
      const current_favor = ns.singularity.getFactionFavor(faction);
      const current_rep = ns.singularity.getFactionRep(faction);
      const new_favor = ns.formulas.reputation.calculateRepToFavor(current_rep + ns.formulas.reputation.calculateFavorToRep(current_favor));
      const rep_to_150 = ns.formulas.reputation.calculateFavorToRep(150) - current_rep - ns.formulas.reputation.calculateFavorToRep(current_favor);
      ns.tprintf("%s: %s favor, %s rep, will become %s favor%s%s%s",
        format_servername(faction),
        format_number(current_favor, { round: 2 }),
        format_number(current_rep, { round: 0 }),
        format_number(new_favor, { round: 2}),
        rep_to_150 > 0 ? `, ${format_number(rep_to_150, { round: 0 })}` : '',
        rep_to_150 > 0 ? ` more rep to ` : '',
        rep_to_150 > 0 ? `${format_number(150)} favor` : ''
      );
    }
  })
  //ns.tprint(`ns.formulas.reputation.calculateFavorToRep(100) -> ${ns.formulas.reputation.calculateFavorToRep(100)}`);
  //ns.tprint(`ns.formulas.reputation.calculateFavorToRep(150) -> ${ns.formulas.reputation.calculateFavorToRep(150)}`);
  //ns.tprint(`ns.formulas.reputation.calculateRepToFavor(75000) -> ${ns.formulas.reputation.calculateRepToFavor(75000)}`);
}
