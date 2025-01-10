import { AutocompleteData, Multipliers, NS } from '@ns'
import { SingularityAsync } from '/lib/singu-interface';
import { singularity_async as singularity_async } from './lib/singu';
import { colors, format_data, format_number, format_servername, print_table } from '/lib/colors';
import { format_currency } from '/lib/format-money';
import { binary_search } from '/lib/binary-search';

// TODO: lib this
export function money_for_rep(ns: NS, rep: number) {
  const player = ns.getPlayer();
  const amount = binary_search((x: number) => ns.formulas.reputation.repFromDonation(x, player), rep, 1e9, 1e13, {unbounded: true});
  if (amount < 0) {
    return -(amount + 1);
  }
  return amount;
}

interface AugData {
  name: string;
  supplier_factions: FactionData[];
  price: number;
  rep: number;
  prereqs: string[];
  mults: Multipliers;
  owned: boolean;
  categories: string[];
}

interface FactionData {
  name: string;
  rep: number;
  favor: number;
  supplied_augs: string[];
}

const aug_categories: Map<string, (a: AugData) => boolean> = new Map([
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
  ['ALL', (a) => a.supplier_factions.length !== 1 || a.supplier_factions[0].name !== 'Shadows of Anarchy'],
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return ['--live', '--dry-run', ...aug_categories.keys(), ';'];
}

const plus = `${colors.fg_red}+${colors.reset}`;

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(4.75);
  const factions: Map<string, FactionData> = new Map();
  const augmentations: Map<string, AugData> = new Map();
  const categories: Map<string, AugData[]> = new Map(aug_categories.keys().map(d => [d, []]));

  const sing: SingularityAsync = singularity_async(ns);
  // Fill out factions/augmentations data
  {
    const joined_factions = ns.getPlayer().factions;
    const owned_by_player: Set<string> = new Set(await sing.getOwnedAugmentations(true));
    for (const faction of joined_factions) {
      const augs = await sing.getAugmentationsFromFaction(faction);
      const fac_data = {
        name: faction,
        rep: await sing.getFactionRep(faction),
        favor: await sing.getFactionFavor(faction),
        supplied_augs: augs,
      };
      factions.set(faction, fac_data);
      for (const aug of augs) {
        const aug_data = augmentations.get(aug);
        if (aug_data) {
          aug_data.supplier_factions.push(fac_data);
        } else {
          const aug_data: AugData = {
            name: aug,
            supplier_factions: [fac_data],
            price: await sing.getAugmentationBasePrice(aug),
            rep: await sing.getAugmentationRepReq(aug),
            prereqs: await sing.getAugmentationPrereq(aug),
            mults: await sing.getAugmentationStats(aug),
            owned: owned_by_player.has(aug),
            categories: [],
          };
          aug_data.categories = [...aug_categories.entries()].filter(([_, f]) => f(aug_data)).map(([k, _]) => k);
          for (const cat of aug_data.categories) {
            categories.get(cat)?.push(aug_data);
          }
          augmentations.set(aug, aug_data);
        }
      }
    }

    // Sort suppliers by reputation descending while reputation exceeds what is required. Below that, prioritize
    // supplier factions with enough favor to purchase reputation, then by reputation descending again.
    for (const aug_data of augmentations.values()) {
      aug_data.supplier_factions.sort((l, r) => {
        if (l.rep > aug_data.rep && r.rep > aug_data.rep) {
          return r.rep - l.rep;
        }
        const [lf, rf] = [l.favor >= 150, r.favor >= 150];
        if (lf !== rf) {
          return lf ? 1 : -1;
        }
        return r.rep - l.rep;
      });
    }
  }

  // Print out the information we've gathered
  const opts = [];
  opts[3] = opts[4] = { left: false };
  print_table(ns, (ns: NS) => {
    const format_aug_faction = (fac_data: FactionData, rep_needed: number) => {
      const rep_have = fac_data.rep;
      const rep_shortfall = rep_needed - rep_have;
      if (rep_shortfall <= 0) {
        return `${colors.fg_white}${fac_data.name}${colors.reset}`;
      }
      const favor_have = fac_data.favor;
      if (favor_have >= 150) {
        const money_needed = money_for_rep(ns, rep_shortfall);
        return `${colors.fg_cyan}${fac_data.name}${colors.reset}[${format_currency(money_needed)}/${plus}${format_number(rep_shortfall)} rep]`;
      }
      return `${colors.fg_yellow}${fac_data.name}${colors.reset}[${plus}${format_number(rep_shortfall, { round: 1 })} rep]`;
    };
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const aug_data of [...augmentations.values()].sort((l, r) => r.price - l.price)) {
      if (aug_data.owned) {
        continue;
      }
      const categories = aug_data.categories.filter(d => d !== 'ALL');
      ns.tprintf(`%s${colors.reset} %s %s rep; via %s %s`,
        `${aug_data.price > ns.getPlayer().money ? colors.fg_red : ''}${aug_data.name}`,
        format_currency(aug_data.price),
        format_number(aug_data.rep, { round: 0 }),
        `[${aug_data.supplier_factions.map(d=>`${format_aug_faction(d, aug_data.rep)}`).join(', ')}]`,
        categories.length > 0 ? `(${categories.map(d=>`${colors.fg_magenta}${d}${colors.reset}`).join(', ')})` : `(${colors.fg_red}???${colors.reset})`,
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


  // Parse and structure priorities
  const p_args = ns.args.map(String).filter(d => !d.startsWith('--'));
  const priorities: string[][] = p_args.reduce((acc: string[][], d: string) => {
    if (d === ';') {
      acc.push([]);
    } else {
      acc[acc.length - 1].push(d);
    }
    return acc;
  }, [[]]);

  // Perform selections
  const selected: AugData[] = [];
  const selected_set: Set<AugData> = new Set();

  const money_available = ns.getPlayer().money;
  let money_spent = 0;

  const aug_scaling = 1.9;

  // TODO: Special handling for neuroflux
  // TODO: Special handling for Shadows of Anarchy
  for (const priority of priorities) {
    const available_augmentations = [...new Set(priority.reduce((acc: AugData[], category_or_augname: string) => {
      // See if this is a category
      const category_list = categories.get(category_or_augname);
      if (category_list) {
        return acc.concat(category_list);
      }
      // See if this is an augmentation
      const aug = augmentations.get(category_or_augname);
      if (aug === undefined) {
        ns.tprint(`ERROR Unknown Category or Augmentation: ${format_servername(category_or_augname)}`);
        return acc;
      }
      acc.push(aug);
      return acc;
    }, []).filter(d => d && !d.owned && !selected_set.has(d))).values()];

    // Sort by cheapest first
    available_augmentations.sort((l, r) => l.price - r.price);

    // Select as many as possible
    for (const aug of available_augmentations) {
      // TODO: This cost adjustment does not work with multiple priorities, nor does it account for prerequisites
      // TODO: Faction reputation purchasing is also not implemented, though this is relatively minor
      const cost = aug.price * aug_scaling ** selected.length;
      if (cost + money_spent > money_available) {
        break;
      }
      selected.push(aug);
      selected_set.add(aug);
      money_spent += aug.price;
    }
  }

  // Print out the plan
  ns.tprint('Purchase plan:');
  const purchased = new Set();
  const reordering_recovered = new Set();
  opts.length = 0;
  opts[1] = opts[4] = { left: false };
  let ok = true;
  print_table(ns, (ns: NS) => {
    do {
      const aug = selected.pop();
      if (!aug) {
        break;
      }
      let extra = '';
      if (aug.prereqs.length > 0) {
        // Double check we have all prerequisites, either already owned now or earlier in the plan
        const missing_prereqs = aug.prereqs.filter(d => !purchased.has(d) && augmentations.get(d)?.owned !== true);
        if (missing_prereqs.length > 0) {
          // FIXME Quick hack: See if the prereq is later in the plan, and if so, move it up
          // This does not preserve optimality: The cost of a conceptual block is a an exponentially decaying weighted
          // average of the elements, and should be reinserted accordingly (though it shouldn't be too far off in
          // practice)
          // This does not preserve correctness: This increases the cost over what was planned for, and may exceed the
          // player's available money
          if (!reordering_recovered.has(aug.name)) {
            // ...but we'll only do this at most once for any aug, for safety
            const to_reinsert = [aug];
            let this_ok = true;
            for (const missing of missing_prereqs.sort((l, r) => (augmentations.get(l)?.price ?? 0) - (augmentations.get(r)?.price ?? 0))) {
              const idx = selected.findIndex(d => d.name === missing);
              if (idx !== -1) {
                // OK, ish
                to_reinsert.push(selected.splice(idx, 1)[0]);
                continue;
              }
              // Couldn't recover
              this_ok = false;
            }

            // If we could recover all prerequisites, reinsert everything, and restart from our current index
            if (this_ok) {
              reordering_recovered.add(aug.name);
              selected.push(...to_reinsert);
              continue;
            }
          }

          // Otherwise, we can't purchase this augmentation, and this plan is invalid
          extra = ` - ${colors.fg_red}missing${colors.reset} ${missing_prereqs.map(d => format_servername(d)).join(', ')}`;
          ok = false;
        }
      }
      const scaling = aug_scaling ** purchased.size;
      const cost = aug.price * scaling;
      ns.tprintf(` - %s at %s = %s %s%s`,
        `${aug.name}`,
        format_currency(cost),
        format_currency(aug.price),
        `x${format_number(scaling, { round: 2 })}`,
        extra,
      );
      purchased.add(aug.name);
    } while (selected.length > 0);
  }, opts);

  if (reordering_recovered.size > 0) {
    ns.tprint(`WARNING Recovered invalid plan by reordering ${format_number(reordering_recovered.size)} augmentations with prerequisites.`);
  }

  // Done

  if (do_commit) {
    if (!ok) {
      ns.tprint('ERROR: Created invalid plan, aborting.');
      return;
    }
    ns.tprint('WARNING --live is not yet implemented!');
  }
}
