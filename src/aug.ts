import { AutocompleteData, Multipliers, NS } from '@ns'
import { SingularityAsync } from '/lib/singu-interface';
import { singularity_async as singularity_async } from './lib/singu';
import { colors, format_data, format_number, print_table } from '/lib/colors';
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
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...aug_categories.keys(), ';'];
}

const plus = `${colors.fg_red}+${colors.reset}`;

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(4.75);
  const factions: Map<string, FactionData> = new Map();
  const augmentations: Map<string, AugData> = new Map();

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
      ns.tprintf(`%s${colors.reset} %s %s rep; via %s %s`,
        `${aug_data.price > ns.getPlayer().money ? colors.fg_red : ''}${aug_data.name}`,
        format_currency(aug_data.price),
        format_number(aug_data.rep, { round: 0 }),
        `[${aug_data.supplier_factions.map(d=>`${format_aug_faction(d, aug_data.rep)}`).join(', ')}]`,
        aug_data.categories.length > 0 ? `(${aug_data.categories.map(d=>`${colors.fg_magenta}${d}${colors.reset}`).join(', ')})` : `(${colors.fg_red}???${colors.reset})`,
      );
    }
  }, opts);
}
