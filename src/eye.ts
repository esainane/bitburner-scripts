import { NS } from '@ns';
import { BladeburnerUpgrader } from '/lib/bladeburner/upgrader';
import { BladeBurnerActor as BladeburnerActor } from '/lib/bladeburner/actor';

// "Her eyes were green."

export async function main(ns: NS): Promise<void> {
  const bonus_time_multiplier = 5;
  const bladeburner_base_interval = 1000;
  const jitter_tolerance = 20;

  const upgrader = new BladeburnerUpgrader(ns);
  const actor = new BladeburnerActor(ns);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await ns.bladeburner.nextUpdate();

    // Buy any available upgrades
    upgrader.buy_upgrades(ns);

    // If we just started our action, evaluate whether it's the one we want to be taking
    const threshold = bladeburner_base_interval * (ns.bladeburner.getBonusTime() > 0 ? bonus_time_multiplier : 1) + jitter_tolerance;
    if (ns.bladeburner.getActionCurrentTime() >= threshold) {
      // If not, wait until we wouldn't be interrupting something we have already sunk non-trivial time into
      continue;
    }

    actor.select_action(ns);
  }
}
