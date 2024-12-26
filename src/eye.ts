import { BladeburnerActionName, BladeburnerActionType, NS } from '@ns'

// "Her eyes were green."

function act(ns: NS, type: BladeburnerActionType | `${BladeburnerActionType}`, name: BladeburnerActionName | `${BladeburnerActionName}`): void {
  const current = ns.bladeburner.getCurrentAction();
  if (current) {
    const [ current_type, current_name ] = [ current.type, current.name ];
    if (current_type == type && current_name == name) {
      return;
    }
  }
  ns.bladeburner.startAction(type, name);
}

export async function main(ns: NS): Promise<void> {
  const cycle_sleep = 5000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await ns.asleep(cycle_sleep);
    // If our current action is well underway, wait until it finishes
    const current_action = ns.bladeburner.getCurrentAction();
    const current_elapsed = ns.bladeburner.getActionCurrentTime();
    if (current_action && current_elapsed > cycle_sleep - 100) {
      const total_time_needed = ns.bladeburner.getActionTime(current_action.type as BladeburnerActionType, current_action.name as BladeburnerActionName);
      await ns.asleep(Math.max(0, total_time_needed - current_elapsed - cycle_sleep + 100));
      continue;
    }
    // If our combat stats are very low, improve them
    const player = ns.getPlayer();
    const premult_skills = [
      player.skills.strength / player.mults.strength,
      player.skills.defense / player.mults.defense,
      player.skills.dexterity / player.mults.dexterity,
      player.skills.agility / player.mults.agility
    ];
    const average_combat_premult = premult_skills.reduce(
      (l, r) => l + r
    ) / premult_skills.length;
    if (average_combat_premult < 110) {
      act(ns, "General", "Training");
      continue;
    }
    // If Charisma is low, improve via recruitment
    if (player.skills.charisma / player.mults.charisma < 100) {
      act(ns, "General", "Recruitment");
      continue;
    }
    // If Stamina is very low, or if stamina is somewhat low and
    // there is also player health missing, recover
    const [current_stamina, max_stamina] = ns.bladeburner.getStamina();
    const { current: hp, max: max_hp } = player.hp;
    if (current_stamina < max_stamina / 2 || (current_stamina < max_stamina * 0.95 && hp < max_hp)) {
      act(ns, 'General', 'Hyperbolic Regeneration Chamber');
      continue;
    }
    // If we're uncertain about probabilities, do field analysis to improve them
    const [tracking_chance_min, tracking_chance_max] = ns.bladeburner.getActionEstimatedSuccessChance('Contracts', 'Tracking');
    if (Math.abs(tracking_chance_max - tracking_chance_min) > 0.05) {
      act(ns, 'General', 'Field Analysis');
      continue;
    }
    // If our odds aren't great, train up
    if (tracking_chance_min < 0.7) {
      act(ns, 'General', 'Training');
      continue;
    }
    // Otherwise, get tracking
    act(ns, 'Contracts', 'Tracking');
    continue;
  }
}
