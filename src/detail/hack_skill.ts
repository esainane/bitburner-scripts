import { NS } from '@ns'
import { format_number, format_servername } from '/lib/colors';

export async function main(ns: NS): Promise<void> {
  let hack_level_needed;
  let goal;
  if (typeof ns.args[0] === 'number') {
    hack_level_needed = ns.args[0];
    goal = `reach hacking level ${format_number(hack_level_needed)}`;
  } else {
    const target = ns.args[0] as string ?? 'w0r1d_d43m0n';
    const server = ns.getServer(target);
    if (!server) {
      ns.tprint(`ERROR - Server ${target} not found`);
      return;
    }
    hack_level_needed = server.requiredHackingSkill ?? 0;
    goal = `crack ${format_servername(target)}`;
  }
  const mult = ns.getPlayer().mults.hacking * ns.getBitNodeMultipliers().HackingLevelMultiplier;
  const hack_xp_needed = ns.formulas.skills.calculateExp(hack_level_needed, mult);
  const hack_xp_current = ns.getPlayer().exp.hacking;
  const to_gain = hack_xp_needed - hack_xp_current;
  ns.tprint(`Need ${format_number(to_gain, {round: 2})} additional xp to ${goal} (${format_number(hack_xp_needed, {round: 2})} total for ${format_number(hack_level_needed)}; mult is x${format_number(mult, {round: 4})})`);
}
