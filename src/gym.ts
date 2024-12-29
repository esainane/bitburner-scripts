import { AutocompleteData, GymType, NS } from '@ns'
import { singularity_async } from '/lib/singu';
import { format_number } from '/lib/colors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return ['150'];
}

function get_player_combat_premult(ns: NS) {
  const player = ns.getPlayer();
  const premult_skills = [
    player.skills.strength / player.mults.strength,
    player.skills.defense / player.mults.defense,
    player.skills.dexterity / player.mults.dexterity,
    player.skills.agility / player.mults.agility
  ];
  return premult_skills;
}

function get_average_player_combat_premult(ns: NS) {
  const premult_skills = get_player_combat_premult(ns);
  const average_combat_premult = premult_skills.reduce(
    (l, r) => l + r
  ) / premult_skills.length;
  return average_combat_premult;
}

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(4.75);
  // Simple gym script: level up the combat skill with the lowest unmultiplied level until the passed threshold is met,
  // or the script is killed
  let threshold = Infinity;
  if (ns.args.length > 0) {
    threshold = Number(ns.args[0]);
  }

  if (ns.args.includes('--print')) {
    ns.tprint(`Current average: ${format_number(get_average_player_combat_premult(ns))}`);
    return;
  }
  const singu = singularity_async(ns);

  while (get_average_player_combat_premult(ns) < threshold) {
    const premult_skills = get_player_combat_premult(ns);
    const min_skill = Math.min(...premult_skills);
    const min_skill_index = premult_skills.indexOf(min_skill);
    // Using the real enums will cause an @ns import to be emitted, which makes the script unusable by bitburner
    const skill_names: `${GymType}`[] = ['str', 'def', 'dex', 'agi'];
    const skill = skill_names[min_skill_index];
    ns.print(`Training ${skill} to ${ns.print(`${threshold}`)}`);
    await singu.gymWorkout('Powerhouse Gym', skill, false);
    await ns.asleep(5000);
  }
}
