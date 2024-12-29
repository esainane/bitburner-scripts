import { NS } from '@ns'
import { SingularityAsync } from '/lib/singu-interface';
import { singularity_async as singularity_async } from './lib/singu';
import { colors, format_data, format_number, print_table } from '/lib/colors';
import { currency_format } from '/lib/format-money';
import { binary_search } from '/lib/binary-search';

function money_for_rep(ns: NS, rep: number) {
  const player = ns.getPlayer();
  const amount = binary_search((x: number) => ns.formulas.reputation.repFromDonation(x, player), rep, 1e9, 1e13, {unbounded: true});
  if (amount < 0) {
    return -(amount + 1);
  }
  return amount;
}

const plus = `${colors.fg_red}+${colors.reset}`;

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(4.75);
  const factions = ns.getPlayer().factions;
  const augmentations_by_faction: Map<string, string[]> = new Map();
  const factions_by_augmentation: Map<string, string[]> = new Map();
  const price_by_augmentation: Map<string, number> = new Map();
  const rep_by_augmentation: Map<string, number> = new Map();
  const prereqs_by_augmentation: Map<string, string[]> = new Map();
  const rep_by_faction: Map<string, number> = new Map();
  const favor_by_faction: Map<string, number> = new Map();
  const sing: SingularityAsync = singularity_async(ns);
  const owned_by_player: Set<string> = new Set(await sing.getOwnedAugmentations(true));
  for (const faction of factions) {
    const augs = await sing.getAugmentationsFromFaction(faction);
    rep_by_faction.set(faction, await sing.getFactionRep(faction));
    favor_by_faction.set(faction, await sing.getFactionFavor(faction));
    augmentations_by_faction.set(faction, augs);
    for (const aug of augs) {
      const aug_list = factions_by_augmentation.get(aug);
      if (aug_list) {
        aug_list.push(faction);
      } else {
        factions_by_augmentation.set(aug, [faction]);
        price_by_augmentation.set(aug, await sing.getAugmentationBasePrice(aug));
        rep_by_augmentation.set(aug, await sing.getAugmentationRepReq(aug));
        prereqs_by_augmentation.set(aug, await sing.getAugmentationPrereq(aug));
      }
    }
  }
  const opts = [];
  opts[3] = { left: false };
  print_table(ns, (ns: NS) => {
    const format_aug_faction = (faction: string, rep_needed: number, aug: string) => {
      const rep_have = rep_by_faction.get(faction)!;
      const rep_shortfall = rep_needed - rep_have;
      if (rep_shortfall <= 0) {
        return `${colors.fg_white}${aug}${colors.reset}`;
      }
      const favor_have = favor_by_faction.get(faction)!;
      if (favor_have >= 150) {
        const money_needed = money_for_rep(ns, rep_shortfall);
        return `${colors.fg_cyan}${aug}${colors.reset}[${currency_format(money_needed)}/${plus}${format_number(rep_shortfall)} rep]`;
      }
      return `${colors.fg_yellow}${aug}${colors.reset}[${plus}${format_number(rep_shortfall, { round: 1 })} rep]`;
    };
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const [augmentation, factions] of [...factions_by_augmentation.entries()].sort(([la, lf], [ra, rf]) => price_by_augmentation.get(ra)! - price_by_augmentation.get(la)!)) {
      if (owned_by_player.has(augmentation)) {
        continue;
      }
      ns.tprintf(`%s${colors.reset} %s %s rep; via %s`,
        `${price_by_augmentation.get(augmentation)! > ns.getPlayer().money ? colors.fg_red : ''}${augmentation}`,
        currency_format(price_by_augmentation.get(augmentation)!),
        format_number(rep_by_augmentation.get(augmentation)!, { round: 0 }),
        `[${factions_by_augmentation.get(augmentation)!.map(d=>`${format_aug_faction(d, rep_by_augmentation.get!(augmentation)!, d)}`).join(', ')}]`,
      );
    }
  }, opts);
}
