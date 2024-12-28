import { BladeburnerActionName, BladeburnerActionType, NS } from '@ns'
import { ActionEntry, bladeburner_actions_data } from '/lib/burner';

// "Her eyes were green."

const min_success_rate = 30;

function act(ns: NS, type: BladeburnerActionType | `${BladeburnerActionType}`, name: BladeburnerActionName | `${BladeburnerActionName}`): void {
  ns.print('Selectied ', type, ', ', name);
  const current = ns.bladeburner.getCurrentAction();
  if (current) {
    const [ current_type, current_name ] = [ current.type, current.name ];
    if (current_type == type && current_name == name) {
      return;
    }
  }
  ns.bladeburner.startAction(type, name);
}

function bonus_adjust(ns: NS, time: number) {
  const bonus_time = ns.bladeburner.getBonusTime();
  const bonusable_time = Math.min(bonus_time, time);
  const unbonusable_time = time - bonusable_time;
  return bonusable_time / 5 + unbonusable_time;
}

export async function main(ns: NS): Promise<void> {
  const cycle_sleep = 500;
  const jitter_padding = 20;
  const jitter_tolerance = 50;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // If our current action is well underway, wait until it finishes
    let time_remaining = 0;
    const current_action = ns.bladeburner.getCurrentAction();
    const current_elapsed = ns.bladeburner.getActionCurrentTime();
    if (current_action) {
      const total_time_needed = ns.bladeburner.getActionTime(current_action.type as BladeburnerActionType, current_action.name as BladeburnerActionName);
      time_remaining = total_time_needed - current_elapsed;
      ns.print("Elapsed ", current_elapsed, 'ms out of ', total_time_needed, 'ms; ', time_remaining, 'ms remaining');
    }
    await ns.asleep(bonus_adjust(ns, Math.max(cycle_sleep, time_remaining + jitter_padding)));
    const new_current_elapsed = ns.bladeburner.getActionCurrentTime();
    if (new_current_elapsed >= 5000 + jitter_tolerance) {
      ns.print('Overshot by ', new_current_elapsed, 'ms, retrying.');
      continue;
    }

    ns.print('Current action only ', new_current_elapsed, 'ms underway. Running selection logic.');
    // If our combat stats are very low, improve them
    const player = ns.getPlayer();
    const skills = [
      player.skills.strength,
      player.skills.defense,
      player.skills.dexterity,
      player.skills.agility,
    ];
    const average_combat = skills.reduce((l, r) => l + r) / skills.length;
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

    // Select the best available action: We consider an action available if it has >70% success (and contracts/missions
    // remaining where applicable), and define best as highest rep per minute
    // Filter by max chance, so we have a chance to narrow the range if we're just experiencing high uncertainty.
    const actions_data = bladeburner_actions_data(ns).filter(d => d.rep_gain_per_minute > 0);
    actions_data.sort((l,r) => l.rep_gain_per_minute - r.rep_gain_per_minute);
    const viable_actions = actions_data.filter(d => d.remaining >= 1 && d.max_chance >= min_success_rate);
    const entry: ActionEntry | undefined = viable_actions.pop();
    if (entry !== undefined) {
      if (entry.min_chance < min_success_rate) {
        // Improve our analysis before committing
        act(ns, 'General', 'Field Analysis');
        continue;
      }
      const { type, action: name } = entry;
      // Just go for it
      act(ns, type, name);
      continue;
    }
    const aim_entry = actions_data.pop();
    if (aim_entry === undefined) {
      throw new Error('No actions available (How?)');
    }

    // Try to work out what's wrong
    // - Are we undertrained?
    // - Too much chaos to operate effectively?
    // - Out of contracts?

    // If we're out of contracts, try to get more
    if (actions_data.find(d => d.max_chance >= min_success_rate && d.remaining < 1) !== undefined) {
      act(ns, 'General', 'Incite Violence');
      continue;
    }

    // Use a rough heuristic for whether skill or chaos is currently more important
    // If there's a lot of chaos, try to cut it down
    const chaos = ns.bladeburner.getCityChaos(ns.bladeburner.getCity());
    if ((5 + chaos) * (6 * chaos) > average_combat) {
      act(ns, 'General', 'Diplomacy');
      continue;
    }

    // Otherwise, just train
    act(ns, 'General', 'Training');
    continue;
  }
}
