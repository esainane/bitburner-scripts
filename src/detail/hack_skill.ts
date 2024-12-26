import { NS } from '@ns'
import { format_number, format_servername } from '/lib/colors';

export async function main(ns: NS): Promise<void> {
  const target = ns.args[0] as string ?? 'w0r1d_d43m0n';
  const server = ns.getServer(target);
  if (!server) {
    ns.tprint(`ERROR - Server ${target} not found`);
    return;
  }
  const hack_level_needed = server.requiredHackingSkill ?? 0;
  const hack_xp_needed = ns.formulas.skills.calculateExp(hack_level_needed);
  const hack_xp_current = ns.getPlayer().exp.hacking;
  const to_gain = hack_xp_needed - hack_xp_current;
  ns.tprint(`Need ${format_number(Math.ceil(100 * to_gain) / 100)} additional xp to crack ${format_servername('w0r1d_d43m0n')} (${format_number(hack_xp_needed)} total for ${hack_level_needed})`);
}
