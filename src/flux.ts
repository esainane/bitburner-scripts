import { NS } from '@ns'
import { singularity_async } from '/lib/singu';
import { money_for_rep } from '/aug';

const favor_by_faction = new Map();
const rep_by_faction = new Map();

function get_best_faction(ns: NS, needs_favor = false): string {
  return ns.getPlayer().factions
    .filter(d => (!ns.gang.inGang() || ns.gang.getGangInformation().faction !== d) && d !== 'Shadows of Anarchy' && (!needs_favor || favor_by_faction.get(d) > 150))
    .map(d => [rep_by_faction.get(d), d])
    .reduce(([lr, ln], [rr, rn]) => lr > rr ? [lr, ln] : [rr, rn], [0, ''])[1];
}

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(7.75);
  const singu = singularity_async(ns);
  for (const faction of ns.getPlayer().factions) {
    favor_by_faction.set(faction, await singu.getFactionFavor(faction));
    rep_by_faction.set(faction, await singu.getFactionRep(faction));
  }
  let best_faction = await get_best_faction(ns);
  // Buy as many neuroflux governors as we can
  while (ns.getPlayer().money > await singu.getAugmentationPrice('NeuroFlux Governor')) {
    const result = await singu.purchaseAugmentation(best_faction, 'NeuroFlux Governor');
    if (result) {
      continue;
    }
    // Something failed
    // Check if we need more reputation
    const rep_needed = await singu.getAugmentationRepReq('NeuroFlux Governor');
    if (rep_by_faction.get(best_faction) < rep_needed) {
      // Find the best faction we can get reputation with
      best_faction = get_best_faction(ns, true);

      if (best_faction === '') {
        // Can't find a suitable faction we can get favor by donating to
        break;
      }

      // Determine the cost of the reputation we need
      const rep_have = await singu.getFactionRep(best_faction);
      const rep_shortfall = rep_needed - rep_have;
      if (rep_shortfall <= 0) {
        // Failed for some other reason
        break;
      }
      // This search is expensive, so sleep a little to make sure we don't cause bitburner to freeze
      await ns.asleep(100);
      const money_needed = money_for_rep(ns, rep_shortfall);
      if (money_needed > ns.getPlayer().money) {
        // We don't have enough money to buy the reputation
        break;
      }
      // Buy the reputation we need
      await singu.donateToFaction(best_faction, money_needed);
      rep_by_faction.set(best_faction, await singu.getFactionRep(best_faction));
    }
  }
}
