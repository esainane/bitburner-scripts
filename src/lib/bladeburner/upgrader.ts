import { NS } from '@ns'
import { PriorityQueue } from '/lib/priority-queue';
import { BladeburnerSkillName } from '/lib/bladeburner/enums';


type UpgradeEntry = {
  cost: number,
  priority: number,
  skill: BladeburnerSkillName
};
export class BladeburnerUpgrader {
  private calculate_upgrade_priority(ns: NS, name: BladeburnerSkillName): [number, number] | undefined {
    const cost = ns.bladeburner.getSkillUpgradeCost(name);
    if (cost === 0 || !isFinite(cost)) {
      return undefined;
    }
    const current_level = ns.bladeburner.getSkillLevel(name);

    switch (name) {
      case BladeburnerSkillName.BladesIntuition:
      case BladeburnerSkillName.DigitalObserver:
        // Increases the success chance of all actions, and for all Operations and BlackOperations, respectively.
        // These are our first set of bread and butter skills later on.
        break;
      case BladeburnerSkillName.Cloak:
      case BladeburnerSkillName.ShortCircuit:
        // Improves the success chance of stealth related, and retirement related actions, respectively.
        // (Affects Contracts, Operations, and BlackOperations).
        // The impact of some cheap levels is important early, but the victory-condition Daedalus chain missions
        // have neither of these attributes.
        if (current_level >= 12) {
          return undefined;
        }
        break;
      case BladeburnerSkillName.Tracer:
        // Increases the success chance of Contracts only
        // Useful very early on most of what we do are contracts
        if (current_level >= 5) {
          return undefined;
        }
        break;
      case BladeburnerSkillName.Overclock:
        // Hyperbolic effect
        // Reduces the time needed for actions additively by 1% each, up to 90% reduction
        // Early on, combat upgrades and improving mission success chances have more of an effect and allow us to gain
        // ranks (and therefore skill points) faster. Later on, nothing compared to operating at 10x speed.
        // Skew the priority a little to factor in that the payoff is much higher than the cost would indicate early on,
        // and is utterly absurd later on.
        if (current_level >= 90) {
          ns.tprint(`ERROR How do we have higher than the expected maximum level in Bladeburner.Overclock?`);
        }
        return [cost, (95 - current_level) / 100 * cost];
      case BladeburnerSkillName.Reaper:
      case BladeburnerSkillName.EvasiveSystem:
        // Increase all combat stats 2%, and increase dex+agi 4% respectively.
        // These are our other bread and butter skills, especially later on when we don't get the Cloak/Short circuit
        // bonuses in the Daedalus chain.
        break;
      case BladeburnerSkillName.Datamancer:
        // Datamancer (improve accurancy estimates) is useless
        return undefined;
      case BladeburnerSkillName.CybersEdge:
        // Increasing max stamina gets regular importance up to level 10, at which point we assume sleeve support will
        // make us less dependent on stamina recovery
        if (current_level >= 10) {
          return undefined;
        }
        break;
      case BladeburnerSkillName.HandsOfMidas:
      case BladeburnerSkillName.Hyperdrive:
        // Money and XP gain can be upgraded somwhat
        if (current_level >= 5) {
          return undefined;
        }
        // But don't prioritize this until it's very cheap relative to other upgrades
        return [cost, cost * 2.5];
    }
    return [cost, cost];
  }

  constructor(ns: NS) {
    this.queue = new PriorityQueue<UpgradeEntry>((l, r) => l.priority - r.priority);
    this.init(ns);
  }

  private init(ns: NS) {
    this.queue.clear();
    const skills = ns.bladeburner.getSkillNames();
    for (const skill of skills) {
      const new_entry = this.calculate_upgrade_priority(ns, skill);
      if (new_entry === undefined) {
        continue;
      }
      const [cost, priority] = new_entry;
      this.queue.push({priority, cost, skill});
    }
  }

  private queue: PriorityQueue<UpgradeEntry>;

  public buy_upgrades(ns: NS) {
    while (this.queue.size()) {
      const top = this.queue.peek();
      if (!top) {
        break;
      }
      const {cost, priority, skill} = top;
      if (cost > ns.bladeburner.getSkillPoints()) {
        break;
      }
      this.queue.pop();
      const success = ns.bladeburner.upgradeSkill(skill);
      if (!success) {
        ns.tprint(`WARNING: Failed to upgrade ${skill} when we expected to (did the player perform manual upgrades?)`);
        // State is broken, rebuild
        this.init(ns);
        continue;
      }
      const new_entry = this.calculate_upgrade_priority(ns, skill);
      if (!new_entry) {
        continue;
      }
      const [new_cost, new_priority] = new_entry;
      this.queue.push({
        cost: new_cost,
        priority: new_priority,
        skill
      });
    }
  }
}
