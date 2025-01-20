import { BladeburnerActionName, BladeburnerActionType, BladeburnerBlackOpName, NS } from '@ns'
import { ActionEntry, bladeburner_actions_data } from '/lib/burner';

export class BladeBurnerActor {
  constructor(ns: NS) {
    // Empty constructor; ns parameter to match convention
  }

  private act(ns: NS, type: BladeburnerActionType | `${BladeburnerActionType}`, name: BladeburnerActionName | `${BladeburnerActionName}`): void {
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

  private min_success_rate_for_type(type: BladeburnerActionType | `${BladeburnerActionType}`): number {
    switch (type) {
      case 'General':
        return 100;
      case 'Contracts':
        return 50;
      case 'Operations':
        return 70;
      case 'Black Operations':
        return 90;
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  public select_action(ns: NS): void {
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
      this.act(ns, "General", "Training");
      return;
    }
    // If Charisma is low, improve via recruitment
    if (player.skills.charisma / player.mults.charisma < 250) {
      this.act(ns, "General", "Recruitment");
      return;
    }
    // If Stamina is very low, or if stamina is somewhat low and
    // there is also player health missing, recover
    const [current_stamina, max_stamina] = ns.bladeburner.getStamina();
    const { current: hp, max: max_hp } = player.hp;
    if (current_stamina < max_stamina / 2 || (current_stamina < max_stamina * 0.95 && hp < max_hp)) {
      this.act(ns, 'General', 'Hyperbolic Regeneration Chamber');
      return;
    }

    // Select the best available action: We consider an action available if it has >70% success (and contracts/missions
    // remaining where applicable), and define best as highest rep per minute
    // Filter by max chance, so we have a chance to narrow the range if we're just experiencing high uncertainty.
    const actions_data = bladeburner_actions_data(ns, false).filter(d =>
      d.rep_gain_per_minute > 0
      && (d.type !== 'Black Operations' || ns.bladeburner.getBlackOpRank(d.action as BladeburnerBlackOpName) <= ns.bladeburner.getRank())
    );
    actions_data.sort((l,r) => l.rep_gain_per_minute - r.rep_gain_per_minute);
    const viable_actions = actions_data.filter(d => d.remaining >= 1 && d.max_chance >= this.min_success_rate_for_type(d.type));
    const entry: ActionEntry | undefined = viable_actions.pop();
    if (entry !== undefined) {
      if (entry.min_chance < this.min_success_rate_for_type(entry.type)) {
        // Improve our analysis before committing
        this.act(ns, 'General', 'Field Analysis');
        return;
      }
      const { type, action: name } = entry;
      // Just go for it
      this.act(ns, type, name);
      return;
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
    if (actions_data.find(d => d.max_chance >= this.min_success_rate_for_type(d.type) && d.remaining < 1) !== undefined) {
      this.act(ns, 'General', 'Incite Violence');
      return;
    }

    // Use a rough heuristic for whether skill or chaos is currently more important
    // If there's a lot of chaos, try to cut it down
    const chaos = ns.bladeburner.getCityChaos(ns.bladeburner.getCity());
    if ((5 + chaos) * (6 * chaos) > average_combat) {
      this.act(ns, 'General', 'Diplomacy');
      return;
    }

    // Otherwise, just train
    this.act(ns, 'General', 'Training');
    return;
  }
}
