import { AutocompleteData, Multipliers, NS } from '@ns'
import { SingularityAsync } from '/lib/singu-interface';
import { singularity_async as singularity_async } from './lib/singu';
import { colors, format_number, format_servername, print_table } from '/lib/colors';
import { format_currency } from '/lib/format-money';
import { binary_search } from '/lib/binary-search';
import { async_filter } from '/lib/collection-async';
import { get_aug_args } from '/lib/aug-bitnode-strategies';

// TODO: lib this
export function money_for_rep(ns: NS, rep: number) {
  const player = ns.getPlayer();
  const amount = binary_search((x: number) => ns.formulas.reputation.repFromDonation(x, player), rep, 1e9, 1e13, {unbounded: true});
  if (amount < 0) {
    return -(amount + 1);
  }
  return amount;
}

type PlanEntry = DepTree | AugData;

// Represent a block of augmentations grouped together as part of a dependency tree
// These are formed when a dependee is not met and costs less than a selected depender
interface DepTree {
  /// For pattern matching as a PlanEntry
  deptree: true;
  /// To be purchased before the rest
  dep: AugData;
  /// To be purchased after the dependency
  rest: PlanEntry[];
  /// Number of entries in this tree total, including the root dependency
  size: number;
  /// Used for positioning
  /// A tree in the simplified form:
  ///  {rest:[1,2,3],dep:4}
  /// has amortized_cost = (4*1.9**0 + 3*1.9**1 + 2*1.9**2 + 1*1.9**3) / 4
  amortized_cost: number;
  /// Used for cost limit checking
  total_cost: number;
}

export interface AugBaseData {
  /// Augmentation name
  name: string;
  /// Base cost of this augmentation, ignoring all scaling factors
  price: number;
  /// Augmentations required before this augmentation can be installed
  prereqs: string[];
  /// Augmentations required before this augmentation can be installed, simplified where possible
  prereqs_simple: string[];
  /// The effects of this augmentation. Does not include special effects like CashRoot
  mults: Multipliers;
  /// Whether or not the player already has this installed (not just queued)
  owned: boolean;
  /// Which categories this augmentation belongs to
  categories: string[];
}

// Represents a single specific augmentation
interface AugData extends AugBaseData {
  /// For pattrern matching as a PlanEntry
  deptree: false;
  /// List of factions which supply this augmentation, to be sorted by most suitable first
  supplier_factions: FactionData[];
  /// Reputation before this can be purchased from a faction
  rep: number;
  /// Is this augmentation graftable?
  graftable: boolean;
}

interface FactionData {
  name: string;
  rep: number;
  favor: number;
  supplied_augs: string[];
  joined: boolean;
}

export const aug_categories: Map<string, (a: AugBaseData) => boolean> = new Map([
  // Augmentations which respectively boost raw hacking skill, hacking experience gain, and hacking performance
  ['hskill', (a) => a.mults.hacking > 1],
  ['hexp', (a) => a.mults.hacking_exp > 1],
  ['hack', (a) => a.mults.hacking_chance > 1 || a.mults.hacking_speed > 1 || a.mults.hacking_money > 1 || a.mults.hacking_grow > 1],
  // Augmentations which respectively boost raw combat skill, combat experience gain, and crime performance
  ['cskill', (a) => a.mults.strength > 1 || a.mults.defense > 1 || a.mults.dexterity > 1 || a.mults.agility > 1],
  ['cexp', (a) => a.mults.strength_exp > 1 || a.mults.defense_exp > 1 || a.mults.dexterity_exp > 1 || a.mults.agility_exp > 1],
  ['crime', (a) => a.mults.crime_success > 1 || a.mults.crime_money > 1],
  // Augmentations for social skill, social experience gain ('social' instead of 'charisma' for a unique prefix)
  ['sskill', (a) => a.mults.charisma > 1],
  ['sexp', (a) => a.mults.charisma_exp > 1],
  // Augmentations which improve hacknet output
  ['hacknet', (a) => a.mults.hacknet_node_money > 1 || a.mults.hacknet_node_purchase_cost < 1 || a.mults.hacknet_node_ram_cost < 1 || a.mults.hacknet_node_core_cost < 1 || a.mults.hacknet_node_level_cost < 1],
  // Bladeburner augmentations
  ['bladeburner', (a) => a.mults.bladeburner_success_chance > 1 || a.mults.bladeburner_analysis > 1 || a.mults.bladeburner_max_stamina > 1 || a.mults.bladeburner_stamina_gain > 1],
  // Augmentations which improve faction reputation gain or company reputation gain
  ['frep', (a) => a.mults.faction_rep > 1],
  ['crep', (a) => a.mults.company_rep > 1],
  // Augmentations which improve job payout
  ['job', (a) => a.mults.work_money > 1],
  // TODO: Handling for Shadows of Anarchy
  ['ALL', (a) => Object.hasOwn(a, 'supplier_factions')
    ? (a as AugData).supplier_factions.length !== 1 || (a as AugData).supplier_factions[0].name !== 'Shadows of Anarchy'
    : true
  ],
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return ['--live', '--dry-run', '--ignore-cost', '--ignore-rep', ...aug_categories.keys(), ";"];
}

const plus = `${colors.fg_red}+${colors.reset}`;

export function categorize_aug<T extends AugBaseData>(ns: NS, aug_data: T, categories: Map<string, T[]>) {
  aug_data.categories = [...aug_categories.entries().filter(([_, f]) => f(aug_data)).map(([k, _]) => k)];
  for (const cat of aug_data.categories) {
    categories.get(cat)?.push(aug_data);
  }
}

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(12.75);
  const factions: Map<string, FactionData> = new Map();
  const augmentations: Map<string, AugData> = new Map();
  const categories: Map<string, AugData[]> = new Map(aug_categories.keys().map(d => [d, []]));

  let graftable;
  try {
    graftable = new Set(ns.grafting.getGraftableAugmentations());
  } catch (e) {
    graftable = new Set<string>();
  }

  const sing: SingularityAsync = singularity_async(ns);

  // Find all factions which exist
  // All factions offers Neuroflux Governor except for Bladeburners, Shadows of Anarchy, and your gang
  const all_factions = [
    ...await sing.getAugmentationFactions('NeuroFlux Governor'),
    'Bladeburners',
    'Shadows of Anarchy',
    ...ns.gang.inGang() ? [ns.gang.getGangInformation().faction] : [],
  ];

  // Fill out factions/augmentations data
  {
    const joined_factions = ns.getPlayer().factions;
    const owned_by_player: Set<string> = new Set(await sing.getOwnedAugmentations(true));
    // First, all player owned augmentations
    for (const aug of owned_by_player.values()) {
      const prereqs = await sing.getAugmentationPrereq(aug);
      const aug_data: AugData = {
        name: aug,
        supplier_factions: [],
        price: await sing.getAugmentationBasePrice(aug),
        rep: await sing.getAugmentationRepReq(aug),
        prereqs,
        prereqs_simple: prereqs.slice(),
        mults: await sing.getAugmentationStats(aug),
        owned: true,
        categories: [],
        deptree: false,
        graftable: graftable.has(aug),
      };
      categorize_aug(ns, aug_data, categories);
      augmentations.set(aug, aug_data);
    }
    // Then, graftable augmentations
    for (const aug of graftable.values()) {
      if (augmentations.has(aug)) {
        continue;
      }
      const prereqs = await sing.getAugmentationPrereq(aug);
      const aug_data: AugData = {
        name: aug,
        supplier_factions: [],
        price: await sing.getAugmentationBasePrice(aug),
        rep: await sing.getAugmentationRepReq(aug),
        prereqs,
        prereqs_simple: prereqs.slice(),
        mults: await sing.getAugmentationStats(aug),
        owned: false,
        categories: [],
        deptree: false,
        graftable: true,
      };
      categorize_aug(ns, aug_data, categories);
      augmentations.set(aug, aug_data);
    }
    // Then, add in faction supplied augmentations and their supplier data
    for (const faction of all_factions) {
      const augs = await sing.getAugmentationsFromFaction(faction);
      const fac_data = {
        name: faction,
        rep: await sing.getFactionRep(faction),
        favor: await sing.getFactionFavor(faction),
        supplied_augs: augs,
        joined: joined_factions.includes(faction),
      };
      factions.set(faction, fac_data);
      for (const aug of augs) {
        const aug_data = augmentations.get(aug);
        if (aug_data) {
          aug_data.supplier_factions.push(fac_data);
        } else {
          const prereqs = await sing.getAugmentationPrereq(aug);
          const aug_data: AugData = {
            name: aug,
            supplier_factions: [fac_data],
            price: await sing.getAugmentationBasePrice(aug),
            rep: await sing.getAugmentationRepReq(aug),
            prereqs,
            prereqs_simple: prereqs.slice(),
            mults: await sing.getAugmentationStats(aug),
            owned: owned_by_player.has(aug),
            categories: [],
            deptree: false,
            graftable: graftable.has(aug),
          };
          categorize_aug(ns, aug_data, categories);
          augmentations.set(aug, aug_data);
        }
      }
    }

    // Sort suppliers by reputation descending while reputation exceeds what is required. Below that, prioritize
    // supplier factions with enough favor to purchase reputation, then by reputation descending again.
    // Exact values are tiebroken by whether you've joined them (unlikely to be relevant except where passive
    // reputation gain is disabled)
    for (const aug_data of augmentations.values()) {
      aug_data.supplier_factions.sort((l, r) => {
        // Identical rep?
        if (r.rep === l.rep && r.joined !== l.joined) {
          // Break by which has favor over the donation threshold, if distinct
          const [lf, rf] = [l.favor >= 150, r.favor >= 150];
          if (lf !== rf) {
            return lf ? -1 : 1;
          }
          // Then whichever is joined first
          return r.joined ? 1 : -1;
        }
        // If both have rep over the purchaseable threshold, put the one with the higher rep first.
        if (l.rep > aug_data.rep && r.rep > aug_data.rep) {
          return r.rep - l.rep;
        }
        // Otherwise, check the favor thresholds. If one is above the donation threshold, put that first.
        const [lf, rf] = [l.favor >= 150, r.favor >= 150];
        if (lf !== rf) {
          return lf ? -1 : 1;
        }
        // If both are below (or above) the favor donation threshold, high rep first.
        return r.rep - l.rep;
      });
    }
  }


  // If something goes wrong, flag it to prevent committing
  let ok = true;

  // Second pass: Simplify augmentation prerequisites
  // All implemented augmentations are either standalone or form a simple prerequisite chain.
  // However, some of these are explicit:
  // "BLADE-51b Tesla Armor: Omnibeam Upgrade" only depends on "BLADE-51b Tesla Armor: Unibeam Upgrade" which itself
  // only depends on "BLADE-51b Tesla Armor")
  // While some are implicit:
  // "Cranial Signal Processors - Gen III" depends on both "Cranial Signal Processors - Gen II", "Cranial Signal
  // Processors - Gen I"
  // We want to simplify this to a form which is more readable and usable. Any prerequisite in a prerequisite list
  // which is implied by any of others is removed from that list.

  // Recursively search a list of prerequisites to see if needle is or is implied by any of them
  const implied_recursive = (needle: string, prereqs: string[], seen: Set<string> = new Set()) => {
    for (const prereq of prereqs) {
      if (needle === prereq) {
        return true;
      }
      if (seen.has(prereq)) {
        continue;
      }
      seen.add(prereq);
      const prereq_data = augmentations.get(prereq);
      if (!prereq_data) {
        ns.tprint(`ERROR Could not look up prerequisite ${format_servername(prereq)} for ${format_servername(needle)}`);
        ok = false;
        continue;
      }
      return implied_recursive(needle, prereq_data.prereqs, seen);
    }
    return false;
  };

  // Perform the second pass
  for (const aug_data of augmentations.values()) {
    aug_data.prereqs_simple = aug_data.prereqs.filter(
      d => !aug_data.prereqs.map(d => augmentations.get(d)).filter(d => d !== undefined).some(
        e => implied_recursive(d, e.prereqs)
      )
    );
  }

  const fg_white_italic = colors.combine(colors.italic, colors.fg_white);
  const fg_cyan_italic = colors.combine(colors.italic, colors.fg_cyan);
  const fg_yellow_italic = colors.combine(colors.italic, colors.fg_yellow);
  // Helper to format faction data
  const format_aug_faction = (fac_data: FactionData, rep_needed: number) => {
    const rep_have = fac_data.rep;
    const rep_shortfall = rep_needed - rep_have;
    if (rep_shortfall <= 0) {
      return `${fac_data.joined ? colors.fg_white : fg_white_italic}${fac_data.name}${colors.reset}`;
    }
    const favor_have = fac_data.favor;
    if (favor_have >= 150) {
      const money_needed = money_for_rep(ns, rep_shortfall);
      return `${fac_data.joined ? colors.fg_cyan : fg_cyan_italic}${fac_data.name}${colors.reset}[${format_currency(money_needed)}/${plus}${format_number(rep_shortfall)}r]`;
    }
    return `${fac_data.joined ? colors.fg_yellow : fg_yellow_italic}${fac_data.name}${colors.reset}[${plus}${format_number(rep_shortfall, { round: 1 })}r]`;
  };
  // Print out the information we've gathered
  const opts = [];
  opts[3] = opts[4] = opts[5] = { left: false };
  print_table(ns, (ns: NS) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const aug_data of [...augmentations.values()].sort((l, r) => r.price - l.price)) {
      if (aug_data.owned) {
        continue;
      }
      const categories = aug_data.categories.filter(d => d !== 'ALL');
      ns.tprintf(`%s${colors.reset} %s %s rep; via %s%s %s %s`,
        `${aug_data.price > ns.getPlayer().money ? colors.fg_red : ''}${aug_data.name}`,
        format_currency(aug_data.price),
        format_number(aug_data.rep, { round: 0 }),
        aug_data.graftable ?
          `${colors.combine(colors.bright,colors.fg_green)}G${colors.reset},` :
          '',
        aug_data.supplier_factions.length > 1 && aug_data.supplier_factions[0].rep > aug_data.rep
          ? `[${format_aug_faction(aug_data.supplier_factions[0], aug_data.rep)}, +${format_number(aug_data.supplier_factions.length - 1)} more...]`
          : aug_data.supplier_factions.length > 3
            ? `[${aug_data.supplier_factions.slice(0, 3).map(d=>`${format_aug_faction(d, aug_data.rep)}`).join(', ')}, +${format_number(aug_data.supplier_factions.length - 3)} more...]`
            : `[${aug_data.supplier_factions.map(d=>`${format_aug_faction(d, aug_data.rep)}`).join(', ')}]`,
        aug_data.prereqs_simple.map(d => format_servername(d)).join(', '),
        categories.length > 0
          ? aug_data.name === 'NeuroFlux Governor'
            ? `(${colors.fg_cyan}ALL${colors.reset})`
            :`(${categories.map(d=>`${colors.fg_magenta}${d}${colors.reset}`).join(', ')})`
          : `(${colors.fg_red}???${colors.reset})`,
      );
    }
  }, opts);

  let do_plan = false;
  let do_commit = false;
  if (ns.args.includes('--live')) {
    do_plan = true;
    do_commit = true;
  } else if (ns.args.includes('--dry-run')) {
    do_plan = true;
  }

  if (!do_plan) {
    return;
  }

  // Plan purchases. We try to maximize the number of purchases, by priority order.

  // The user specifies the priorities for a plan by category:
  //  ./aug.js hskill ; hexp hack ; frep ; cskill ; cexp crime ;bladeburner ; ssocial sexp ; hacknet ; crep ; job
  // The semicolon denotes a priority separation. Categories not separated by semicolons have the same priority, and
  // categories separated by semicolons are ordered by highest priority first.
  // The user can also specify explicit augmentations instead of a category.
  // This example prioritizes augmentations which improve hacking skill above anything else, then hacking experience and
  // performance, then faction reputation, then combat skill, and so on.

  // Between each priority separation, we combine all augmentations which are not owned, not already selected, and are
  // in one of these categories.
  // We then plan to purchase as many as possible.

  // Each purchase increases the cost of all subsequent purchases by 1.9x.
  // We select augmentations by cheapest first, preparing to perform the actual purchases by most expensive first.
  // There are some exceptions where prerequisites are required, but this is the general idea.

  // If nothing more can be selected at this priority level, we move on to the next priority level.

  const aug_scaling = 1.9;

  // Parse and structure priorities
  // Get all positionl args
  const p_args = ns.args.map(String).filter(d => !d.startsWith('--'));
  const process_args = (acc: string[][], d: string): string[][] => {
    const as_num = parseInt(d);
    if (d === ';') {
      // Priority separator, start new priority
      acc.push([]);
    } else if (String(as_num) === d) {
      // Bitnode number, insert the appropriate strategy
      return get_aug_args(as_num).reduce(process_args, acc);
    } else {
      // Augmentation or category
      acc[acc.length - 1].push(d);
    }
    return acc;
  };
  // Process them into priorities
  const priorities: string[][] = p_args.reduce(process_args, [[]]);

  // Perform selections
  let selected: PlanEntry[] = [];
  const selected_set: Set<AugData> = new Set();

  // Cost helpers
  const get_entry_scaling_adjustment = (entry: PlanEntry) => entry.deptree
    ? aug_scaling ** entry.size
    : aug_scaling;
  const get_entry_total_price = (entry: PlanEntry) => entry.deptree
    ? entry.total_cost
    : entry.price;
  const get_entry_amortized_price = (entry: PlanEntry) => entry.deptree
    ? entry.amortized_cost
    : entry.price;
  const get_index_amoritzed_price = (idx: number) => selected.length === 0
    ? 0
    : idx >= selected.length
      ? Infinity
      : get_entry_amortized_price(selected[idx]);
  const format_deptree: (deptree: DepTree) => string = (deptree: DepTree) => `{${format_servername(deptree.dep.name)}: [${deptree.rest.map(d => d.deptree ? format_deptree(d) : format_servername(d.name)).join(', ')}]`;
  const recalculate_plan_cost = (plan: PlanEntry[]) =>
    plan.reduce((acc, d) => {
      const ret = d.deptree
        ? acc * aug_scaling ** d.size + d.total_cost
        : acc * aug_scaling + d.price;
      if (d.deptree) {
        // ns.tprint(`INFO Recalculating cost (${ret} = ${acc} * ${aug_scaling}^${d.size} + ${d.total_cost}) [${format_deptree(d)}]`);
      } else {
        // ns.tprint(`INFO Recalculating cost (${ret} = ${acc} * ${aug_scaling} + ${d.price}) [${format_servername(d.name)}]`);
      }
      return ret;
    }, 0);
  const update_deptree_cost = (deptree: DepTree) => {
    deptree.total_cost = recalculate_plan_cost(deptree.rest) * aug_scaling + deptree.dep.price;
    deptree.size = deptree.rest.reduce((acc, d) => acc + (d.deptree
      ? d.size
      : 1
    ), 1);
    deptree.amortized_cost = deptree.total_cost / deptree.size;
  };
  const shallow_clone_deptree = (deptree: DepTree) => ({
      deptree: true,
      dep: deptree.dep,
      rest: deptree.rest.slice(),
      size: deptree.size,
      amortized_cost: deptree.amortized_cost,
      total_cost: deptree.total_cost,
  } as DepTree)

  // Set a limit on the money available to spend, if applicable
  const money_available = ns.args.includes('--ignore-cost') ? Infinity : ns.getPlayer().money;
  let money_spent = 0;
  const ignore_rep = ns.args.includes('--ignore-rep');

  // Track everything we've seen, to report anything we didn't select at the end
  let considered_augmentations = new Set<AugData>();
  const unpurchasable_augmentations: AugData[] = [];
  const unpurchasable_augmentations_set = new Set<AugData>();

  // TODO: Special handling for neuroflux
  // TODO: Special handling for Shadows of Anarchy
  for (const [prioritiy_level, priority] of priorities.entries()) {
    // Determine all augmentations available at this priority level
    ns.tprint(`INFO Selecting augmentations at priority level ${prioritiy_level + 1}: (${priority.map(d => format_servername(d)).join(', ')})`);
    const available_augmentations = [];
    for (const aug of new Set(priority.reduce((acc: AugData[], category_or_augname: string) => {
      // If this is a category, add everything in it
      const category_list = categories.get(category_or_augname);
      if (category_list) {
        return acc.concat(category_list);
      }
      // If this is an exact augmentation name, add exactly that augmentation
      const aug = augmentations.get(category_or_augname);
      // Otherwise, print an error, but continue
      if (aug === undefined) {
        ok = false;
        ns.tprint(`ERROR Unknown Category or Augmentation: ${format_servername(category_or_augname)}`);
        return acc;
      }
      acc.push(aug);
      return acc;
    }, []).filter(d => d && !d.owned && !selected_set.has(d)))) {
      if (ignore_rep || (aug.supplier_factions.length && aug.rep <= (aug.supplier_factions[0]?.rep ?? 0))) {
        available_augmentations.push(aug);
      } else {
        if (!unpurchasable_augmentations_set.has(aug)) {
          //ns.tprint(`INFO Augmentation ${format_servername(aug.name)} requires ${plus}${format_number(aug.rep)} reputation with ${format_servername(aug.supplier_factions[0].name)} to purchase`);
          unpurchasable_augmentations.push(aug);
          unpurchasable_augmentations_set.add(aug);
        }
      }
    }

    // Once we know everything available this priority level, add them to the set of what we considered
    considered_augmentations = considered_augmentations.union(new Set(available_augmentations));

    // Sort by cheapest first
    available_augmentations.sort((l, r) => l.price - r.price);

    // Select as many as possible
    for (const aug of available_augmentations) {
      // TODO: Faction reputation purchasing is also not implemented, though this is relatively minor
      // First, find any unmet dependencies.
      // 1) Prereqs already part of the plan (to be bought after this) will need to be brought after this in the plan,
      // so they are purchased first.
      // 2) Prereqs not yet in the plan will need to be selected later in the planning process, though this is uncommon
      // (are there any augmentations with a more expensive prerequisite? Maybe something in the Netburner implant tree
      // if you specify unusual priorities?) and might only happen if the player manually specifies a particular
      // augmentation as high priority.
      let local_ok = true;
      // Augs for case 1)
      const to_reorder = (await async_filter(aug.prereqs_simple.map(d => [d, augmentations.get(d)] satisfies [string, AugData?]), async ([name, d]) => {
        if (d === undefined) {
          ns.tprint(`ERROR Could not find prerequisite ${format_servername(name)} for ${format_servername(aug.name)}. (Perhaps join ${(await sing.getAugmentationFactions(name)).map(d => format_servername(d)).join(', ')}?)`);
          ok = local_ok = false;
          return false;
        }
        return !d.owned && selected_set.has(d);
      })).map(d => d[1]) as AugData[];
      if (!local_ok) {
        continue;
      }
      // Augs for case 2)
      // TODO
      const to_require = aug.prereqs_simple.map(d => augmentations.get(d)).filter(d => {
        if (d === undefined) {
          ok = local_ok = false;
          return false;
        }
        return !d.owned && !selected_set.has(d);
      }) as AugData[];
      if (!local_ok) {
        continue;
      }
      if (to_require.length) {
        ns.tprint(`WARNING Augmentation ${format_servername(aug.name)} has prerequisites which would be added later. Ensuring this is the case is not implemented yet: ${to_require.map(d => format_servername(d.name)).join(', ')}`);
      }


      let entry;
      let to_remove;
      if (to_reorder.length) {
        if (to_reorder.length > 1) {
          ns.tprint(`WARNING ${format_servername(aug.name)} has multiple prior dependencies. Handling dependency diamonds is not implemented yet: ${to_reorder.map(d => format_servername(d.name)).join(', ')}`);
        }

        // Recursively find a dependency.
        // Returns the index which would be removed, and a DepTree which would be inserted.
        const find_dep: (needle: AugData, haystack: PlanEntry[]) => [number, DepTree] | [undefined, undefined] = (needle: AugData, haystack: PlanEntry[]) => {
          for (const [idx, prior_selected] of haystack.entries()) {
            if (prior_selected.deptree) {
              if (prior_selected.dep === needle) {
                // Dependency is the depended of an existing deptree
                const to_insert = shallow_clone_deptree(prior_selected);
                to_insert.rest.push(aug);
                // FIXME: Crude, could duplicate insertion logic
                to_insert.rest.sort((l, r) => get_entry_amortized_price(l) - get_entry_amortized_price(r));
                ns.tprint(`INFO New order: ${to_insert.rest.map(d => format_servername(d.deptree ? d.dep.name :d.name)).join(', ')}`);
                update_deptree_cost(to_insert);
                return [idx, to_insert];
              }
              const [rec_remove, rec_insert] = find_dep(needle, prior_selected.rest);
              if (rec_remove !== undefined) {
                // Dependency was found within an existing deptree
                const to_insert = shallow_clone_deptree(prior_selected);
                to_insert.rest.splice(rec_remove, 1, rec_insert);
                update_deptree_cost(to_insert);
                return [idx, to_insert];
              }
            } else {
              // Dependency was an ordinary augmentation
              if (prior_selected.name == needle.name) {
                const to_insert: DepTree = {
                  deptree: true,
                  dep: needle,
                  rest: [aug],
                  size: 2,
                  amortized_cost: Infinity, // placeholder
                  total_cost: Infinity, // placeholder
                };
                update_deptree_cost(to_insert);
                return [idx, to_insert];
              }
            }
          }
          // Dependency was not found
          return [undefined, undefined];
        };
        [to_remove, entry] = find_dep(to_reorder[0], selected);
        if (!entry) {
          // Shouldn't happen, but for the sake of defensiveness
          ok = false;
          ns.tprint(`ERROR Could not find supposedly selected (via selected_set) dependency ${format_servername(to_reorder[0].name)} in selected augmentations`);
          continue;
        }
      } else {
        entry = aug;
      }
      // Then, find where we need to insert the aug. The overwhelmingly most common case will be to add it to the
      // end of the list, so we can check against the first to make this faster.
      const entry_price = get_entry_amortized_price(entry);
      const bsearch_result = entry_price > get_index_amoritzed_price(selected.length - 1)
        ? selected.length
        : binary_search((idx: number) => get_index_amoritzed_price(idx), entry_price, 0, selected.length);
      const insertion_point = bsearch_result < 0 ? -(bsearch_result + 1) : bsearch_result;
      // Construct the new plan. If it's at the end, we just add it to the end, removing to_remove if set.
      const next_selected = insertion_point === selected.length
        ? to_remove === undefined
          ? [...selected, entry]
          : [...selected.slice(0, to_remove), ...selected.slice(to_remove + 1), entry]
        : (() => {
            // Otherwise, make a new list, inserting entry at the insertion point, and removing to_remove if set,
            // both relative to the original list's indices.
            if (to_remove === undefined) {
              return [...selected.slice(0, insertion_point), entry, ...selected.slice(insertion_point)];
            }
            if (to_remove >= insertion_point) {
              return [...selected.slice(0, insertion_point), entry, ...selected.slice(insertion_point, to_remove), ...selected.slice(to_remove + 1)];
            } else {
              return [...selected.slice(0, to_remove), ...selected.slice(to_remove + 1, insertion_point), entry, ...selected.slice(insertion_point)];
            }
          })();
      // Recalculate the cost. If we're only adding to the end, this is just the cost of the new aug plus the cost of
      // everything prior multiplied by the aug_scaling factor.
      // Otherwise, recalculate from the start.
      const next_cost = insertion_point === selected.length && to_remove === undefined
        ? money_spent * get_entry_scaling_adjustment(entry) + get_entry_total_price(entry)
        : recalculate_plan_cost(next_selected);
      // With the addition of dependency handling, the order of available augmentations is no longer the exact cost.
      // If it's a normal augmentation, then the position is exact, and there's no point in looking further.
      // If it's a deptree, then it's an underestimate of cost; it can still be excluded if we meet a non-deptree
      // augmentation which is cheaper and can't be added, but we can't necessarily exclude later options yet.
      // FIXME: Note that this also means that selections are not necessarily optimal, as we might exclude a cheaper
      // augmentation by selecting an augmentation whose dependencies make its selection more expensive.
      // This could be solved by putting deptrees in a separate queue effectively running merge sort as we go,
      // putting any deptrees we make in the subqueue, and then merging the subqueue into the main queue when we hit a
      // normal augmentation which would cost more.
      if (next_cost > money_available) {
        const prefix = `INFO Can't afford inclusion of ${format_servername(aug.name)} for ${format_currency(next_cost)} = ${format_currency(aug.price)} + ${format_currency(money_spent)} x ${aug_scaling};`;
        if (entry.deptree) {
          ns.tprint(prefix, ' checking alternatives.');
          continue;
        } else {
          ns.tprint(prefix, ' stopping.');
          break;
        }
      }
      // DEBUG: Annouce the changes.
      if (insertion_point === selected.length) {
        ns.tprint('INFO Appending ', format_servername(aug.name), ' at ', insertion_point, '; new cost: ', format_currency(next_cost));
      } else {
        ns.tprint('INFO Inserting ', format_servername(aug.name), ' at ', insertion_point, ' of ', selected.length, '; new cost: ', format_currency(next_cost));
      }
      // Finally, apply the changes.
      selected = next_selected;
      selected_set.add(aug);
      money_spent = next_cost;
    }
  }

  // Print out the plan
  ns.tprint('Purchase plan:');
  // Track the overall set of what we've purchased
  const purchased = new Set<string>();
  // Create a purchase queue as we go, containing the faction and the aug we're purchasing from them
  const purchase_queue: [string, string][] = [];
  // Track the actual amount of money spent
  let actual_spent = 0;
  // Stack of deptrees, deepest last
  const current_deptree: DepTree[] = [];
  opts.length = 0;
  opts[1] = opts[4] = { left: false };
  print_table(ns, (ns: NS) => {
    do {
      // Fetch the next element to be purchased: Either the next element in the deepest deptree, depth first, or the
      // next element in the overall selected list
      const next = current_deptree.length
        ? current_deptree[current_deptree.length - 1].rest.pop()
        : selected.pop();
      // If there wasn't anything there...
      if (!next) {
        // ...and we were in a deptree, pop that deptree and continue higher up
        if (current_deptree.length) {
          //ns.tprintf('%s%s%s%s%s', ']', '', '', '', '');
          current_deptree.pop();
          continue;
        }
        // ...and we were at the top level, we're done
        break;
      }
      let aug: AugData;
      if (next.deptree) {
        // If the next element is a deptree, take the dep and push the new deptree onto the stack
        //ns.tprintf('%s%s%s%s%s', '[', '', '', '', '');
        aug = next.dep;
        current_deptree.push(next);
      } else {
        // Otherwise, it's a normal aug
        aug = next;
      }
      let extra = '';
      if (aug.prereqs.length > 0) {
        // Double check we have all prerequisites, either already owned now or purchased earlier
        const missing_prereqs = aug.prereqs.filter(d => !purchased.has(d) && augmentations.get(d)?.owned !== true);
        if (missing_prereqs.length > 0) {
          // We can't purchase this augmentation, this plan is invalid
          extra = ` - ${colors.fg_red}missing${colors.reset} ${missing_prereqs.map(d => format_servername(d)).join(', ')}`;
          ok = false;
        }
      }
      // Check we can actually purchase from the best supplier faction
      const purchase_from = aug.supplier_factions[0];
      if (purchase_from.rep < aug.rep) {
        extra += ` - ${colors.fg_red}missing${colors.reset} ${format_number(aug.rep - purchase_from.rep, { round: 1 })} ${format_servername(purchase_from.name)} rep`;
        ok = false;
      }
      // And print the result
      const scaling = aug_scaling ** purchased.size;
      const cost = aug.price * scaling;
      ns.tprintf(`%s at %s = %s %s%s`,
        `${aug.name}`,
        format_currency(cost),
        format_currency(aug.price),
        `x${format_number(scaling, { round: 2 })}`,
        extra,
      );
      // Track what this plan would do
      actual_spent += cost;
      purchased.add(aug.name);
      purchase_queue.push([purchase_from.name, aug.name]);
    } while (selected.length > 0);
    // Hack in alignment by making this sort of match the number of arguments used for the proper table:
    //  <Total co>st: <number>   <>        <>      <>
    //  <aug name> at <number> = <number> x<number><>
    ns.tprintf(`%sst${colors.reset}: %s%s%s%s`, `${colors.fg_cyan}Total co`, format_currency(actual_spent), '', '', '');
  }, opts);

  // TODO: Refactor this out
  const approx_equal = (a: number, b: number, epsilon = 1e-3) => Math.abs(a - b) < epsilon;

  // Summarize the validation process

  // Check the money we would spend is what we expected it to be
  if (!approx_equal(actual_spent, money_spent, 0.4)) {
    ns.tprint(`WARNING Plan cost mismatch: Actual purchase cost ${format_currency(actual_spent)} (${actual_spent}) != incrementally calculated cost ${format_currency(money_spent)} (${money_spent})`);
    ok = false;
  }
  // Also check the amount we would spend is less than what is available
  if (actual_spent > money_available) {
    ns.tprint(`ERROR Would spend more than available, plan unrecoverable.`);
    ok = false;
  }

  // Remark on which augmentations could not be purchased
  const buying = new Set(purchase_queue.map(d => d[1]));
  const unpurchased = [...considered_augmentations.values()].filter(d => !d.owned && !buying.has(d.name));
  if (unpurchased.length > 0) {
    ns.tprint(`${colors.fg_red}Unpurchased${colors.reset} augmentations: ${unpurchased.map(d=>`${colors.fg_cyan}${d.name}${colors.reset}`).join(', ')}`);
  }
  // Remark on which augmentations could not be purchased due to reputation
  if (unpurchasable_augmentations.length > 0) {
    ns.tprint(`${colors.fg_red}Unpurchasable${colors.reset} augmentations: ${unpurchasable_augmentations.map(d=>`${colors.fg_cyan}${d.name}${colors.reset}[${d.supplier_factions.map(f => format_aug_faction(f, d.rep))}]`).join(', ')}`);
  }
  // Remark on which augmentations were not considered for purchasing at any priority level
  const unconsidered = [...augmentations.values()].filter(d => !d.owned && !considered_augmentations.has(d) && !unpurchasable_augmentations_set.has(d));
  if (unconsidered.length > 0) {
    ns.tprint(`${colors.fg_magenta}Unconsidered${colors.reset} augmentations: ${unconsidered.map(d=>`${colors.fg_cyan}${d.name}${colors.reset}`).join(', ')}`);
  }

  // Done

  if (!do_commit) {
    if (!ok) {
      ns.tprint(`ERROR: Plan is invalid.`);
    }
    return;
  }
  if (!ok) {
    ns.tprint('ERROR: Created invalid plan, aborting.');
    return;
  }
  for (const [faction, aug] of purchase_queue) {
    if (await sing.purchaseAugmentation(faction, aug)) {
      ns.tprint(`Purchased ${format_servername(aug)}`);
    } else {
      ns.tprint(`ERROR Failed to purchase ${format_servername(aug)} from ${format_servername(faction)}`);
    }
  }
}
