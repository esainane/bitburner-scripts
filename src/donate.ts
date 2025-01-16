import { AutocompleteData, NS } from '@ns'
import { singularity_async } from '/lib/singu';
import { format_currency } from '/lib/format-money';
import { format_servername } from '/lib/colors';
import { async_map } from '/lib/collection-async';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return ['--auto', '--rep'];
}

async function simple_dump(ns: NS, singu: ReturnType<typeof singularity_async>, donatable_factions: Map<string, {favor: number, rep: number}>): Promise<void> {
  // Final call to spend all money:
  // Donate to the furtherest of the main story progression factions which can accept donations
  for (const faction of [
    // Victory condition
    'Daedalus',
    // Very lategame, not typically available or required
    'Illuminati', 'The Covenant',
    // Main progression
    'Bitrunners', 'The Black Hand', 'NiteSec', 'CyberSec',
    // Special
    'Tian Di Hui',
    // Combat/alternative
    'Speakers for the Dead', 'The Syndicate', 'Tetrads', 'Slum Snakes']) {
    if (donatable_factions.has(faction)) {
      await singu.donateToFaction(faction, ns.getPlayer().money);
      break;
    }
  }
}

export async function main(ns: NS): Promise<void> {
  const p_args = ns.args.filter(d => typeof d !== 'string' || !d.startsWith('--'));
  const do_auto = ns.args.includes('--auto');
  // RAM dodge
  const singu = singularity_async(ns);

  // Regardless of our strategy, we want to know what factions we can actually donate to, first

  interface FactionData {
    name: string;
    favor: number;
    rep: number;
  }

  // Get all factions and their current favor.
  const player = ns.getPlayer();
  const factions = new Map<string, FactionData>(await async_map<string, [string, FactionData]>(player.factions,
    async d => [d,
    {
      name: d,
      favor: await singu.getFactionFavor(d),
      rep: await singu.getFactionRep(d),
    }
  ]));

  let gang_faction = null;
  // If a gang exists, we care about what it provides; in that we don't want to donate to factions redundantly,
  // supplying what we're already getting through a gang (assume gang rep and favor always skyrockets).
  try {
    gang_faction = ns.gang.getGangInformation().faction;
  } catch (e) {
    // Ignore
  }

  // The favor threshold is usually 150, but some bitnodes are different.
  const favor_donation_threshold = ns.getFavorToDonate();

  // Some factions can never be donated to
  const undonatable_factions = [gang_faction, 'Bladeburners', 'Shadows of Anarchy'];

  // Get a list of all factions which are currently accepting donations.
  const donatable_factions = new Map(factions.entries().filter(([n, d]) => !undonatable_factions.includes(n) && d.favor  >= favor_donation_threshold));

  if (!donatable_factions.size) {
    // Nothing we can do
    return;
  }

  if (do_auto) {
    // If we're asked to run in auto mode, disregard everything else and spend all money as best as we can
    // Act as if we're about to prestige, and will lose any money not spent here.

    let gang_supplied = new Set();

    // Get a list of all unowned, unqueued augmentations, their rep requirements, and their supplier factions.
    const player_augs = new Set(await singu.getOwnedAugmentations(true));
    const missing_augmentations = new Map<string, [number, FactionData[]]>();
    for (const faction of player.factions.filter(d => !undonatable_factions.includes(d))) {
      const faction_data = factions.get(faction);
      if (!faction_data) {
        continue;
      }
      const augs = await singu.getAugmentationsFromFaction(faction);
      if (gang_faction === faction) {
        gang_supplied = new Set(augs);
      }
      for (const aug of augs) {
        if (player_augs.has(aug)) {
          continue;
        }
        const aug_data = missing_augmentations.get(aug);
        if (aug_data) {
          aug_data[1].push(faction_data);
        } else {
          missing_augmentations.set(aug, [
            await singu.getAugmentationRepReq(aug),
            [faction_data],
          ]);
        }
      }
    }

    // For each faction, examine all supplied and missing augmentations which they are the best supplier for,
    // and find the one with the highest rep cost.

    const most_rep_expensive_aug_by_faction = new Map<string, [number, string]>();
    // For each augmentation, find the faction which is the best supplier
    for (const [aug, [rep, suppliers]] of missing_augmentations) {
      // Disregard anything which is already supplied by the gang
      if (gang_supplied.has(aug)) {
        continue;
      }
      for (const supplier of suppliers) {
        // Skip tracking of factions which we can't donate to
        if (!donatable_factions.has(supplier.name)) {
          continue;
        }
        const [current_rep, current_supplier] = most_rep_expensive_aug_by_faction.get(aug) || [0, ''];
        if (rep > current_rep) {
          most_rep_expensive_aug_by_faction.set(aug, [rep, supplier.name]);
        }
      }
    }

    // Use this as a heuristic for how we want our money to be distributed as favor.
    // Note that while money turns into reputation linearly, it doesn't turn into favor linearly.
    const reputation_from_money = ns.formulas.reputation.repFromDonation(player.money, player);

    interface Weighting {
      faction: string;
      weight: number;
      current: number;
    }

    const desired_favor_weights = new Map<string, Weighting>(
      donatable_factions.entries().map(([k, {favor}]): [string, Weighting] | undefined => {
        const entry = most_rep_expensive_aug_by_faction.get(k);
        if (entry === undefined) {
          return undefined;
        }
        const [weight, aug] = entry;
        return [k, {
          faction: k,
          current: favor,
          weight,
        }] satisfies [string, Weighting];
      }).filter(d => d !== undefined) satisfies IteratorObject<[string, Weighting]>
    );

    if (desired_favor_weights.size === 0) {
      // Nothing presents a meaningful need
      await simple_dump(ns, singu, donatable_factions);
      return;
    }

    // Factor in total reputation
    const total_raw_weight = [...desired_favor_weights.values()].reduce((acc, d) => acc + d.weight, 0);

    const sum_raw_reputation = reputation_from_money + [...desired_favor_weights.values()].reduce((acc, d) => acc + d.current, 0);

    // Perform a culling pass: Any faction which has more than its fair share of reputation already, doesn't get more
    for (const [faction, {weight, current}] of desired_favor_weights) {
      const goal_reputation = weight / total_raw_weight * sum_raw_reputation;
      if (goal_reputation <= current) {
        desired_favor_weights.delete(faction);
      }
    }

    // Recalculate based only on those which need more
    const total_weight = [...desired_favor_weights.values()].reduce((acc, d) => acc + d.weight, 0);
    const sum_reputation = reputation_from_money + [...desired_favor_weights.values()].reduce((acc, d) => acc + d.current, 0);

    // Donate proportional to outstanding weights
    // TODO: Consider existing favor, and distribute this based on target favor
    for (const [faction, {weight, current}] of desired_favor_weights) {
      const goal_reputation = weight / total_weight * sum_reputation;
      if (goal_reputation <= current) {
        ns.tprint(`ERROR Why do we still have a faction whose goal_reputation is lower than its current after the culling pass?`);
        await ns.sleep(1000);
        continue;
      }
      const money_donated = (goal_reputation - current) / reputation_from_money;
      ns.tprint(`Donating ${format_currency(money_donated)} to ${format_servername(faction)}`);
      await singu.donateToFaction(faction, money_donated);
    }

    const remainder = ns.getPlayer().money;
    if (remainder < 1e6) {
      return;
    }
    // If there's anything left (rounding errors?) just dump it
    ns.tprint(`Dumping ${format_currency(remainder)}`);
    await simple_dump(ns, singu, donatable_factions);
    return;
  }

  await simple_dump(ns, singu, donatable_factions);
}
