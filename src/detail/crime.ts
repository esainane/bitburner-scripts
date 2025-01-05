import { AutocompleteData, CrimeStats, NS } from '@ns'
import { format_number, format_servername, print_table, percent, colors } from '/lib/colors';
import { singularity_async } from '/lib/singu';
import { format_duration } from '/lib/format-duration';
import { currency_format } from '/lib/format-money';
import { ms_per_min } from '/lib/consts';

interface Crime {
  crime: string;
  odds: number;
  stats: CrimeStats;
}

// Return a value (such as exp gain) normalized by the time it takes to complete the crime, and the odds of success
const normalize = (crime: Crime, value: number): number => {
  const success_reward = value / crime.stats.time;
  const chance = crime.odds;
  return success_reward * chance + success_reward * (1 - chance) / 4;
}

const sorters = new Map<string, (l: Crime, r: Crime) => number>([
  ['hacking', (l, r) => normalize(l, l.stats.hacking_exp) - normalize(r, r.stats.hacking_exp)],
  ['strength', (l, r) => normalize(l, l.stats.strength_exp) - normalize(r, r.stats.strength_exp)],
  ['defense', (l, r) => normalize(l, l.stats.defense_exp) - normalize(r, r.stats.defense_exp)],
  ['dexterity', (l, r) => normalize(l, l.stats.dexterity_exp) - normalize(r, r.stats.dexterity_exp)],
  ['agility', (l, r) => normalize(l, l.stats.agility_exp) - normalize(r, r.stats.agility_exp)],
  ['charisma', (l, r) => normalize(l, l.stats.charisma_exp) - normalize(r, r.stats.charisma_exp)],
  ['intelligence', (l, r) => normalize(l, l.stats.intelligence_exp) - normalize(r, r.stats.intelligence_exp)],
  ['money', (l, r) => normalize(l, l.stats.money) - normalize(r, r.stats.money)],
  ['karma', (l, r) => normalize(l, l.stats.karma) - normalize(r, r.stats.karma)],
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return Array.from(sorters.keys());
}

export async function main(ns: NS): Promise<void> {
  // RAM dodge
  ns.ramOverride(4.25);
  const singu = singularity_async(ns);

  // Get data
  const crimes: Crime[] = [];
  for (const crime of Object.values(ns.enums.CrimeType)) {
    const odds = await singu.getCrimeChance(crime);
    const stats = await singu.getCrimeStats(crime);
    crimes.push({
      crime,
      odds,
      stats,
    });
  }

  // If we're asked to sort by something specific, do so
  if (ns.args.length > 0) {
    const sorter = sorters.get(String(ns.args[0]));
    if (sorter) {
      crimes.sort(sorter);
    } else {
      ns.tprint(`WARNING Unknown sorter: ${ns.args[0]}. Valid sorters: ${Array.from(sorters.keys()).join(', ')}`);
    }
  }

  const empty = `${colors.fg_black}-${colors.reset}`;

  const value = (crime: Crime, value: number, round = 3, do_normalize=true) => {
    return value === 0 ? empty : format_number(do_normalize ? normalize(crime, value) * ms_per_min : value, { round });
  }

  // Print the result
  print_table(ns, (ns: NS) => {
    for (const crime of crimes) {
      ns.tprintf(`%s %s %s%s success; xp/min: %s hck, %s str, %s def, %s dex, %s agi, %s cha, %s int; %s/min, %s karma/min; skill weight: %s hck, %s str, %s def, %s dex, %s agi, %s cha`,
        format_servername(crime.crime),
        format_duration(crime.stats.time, { abs_threshold: -1 }),
        format_number(crime.odds * 100, { round: 1 }),
        percent,
        value(crime, crime.stats.hacking_exp),
        value(crime, crime.stats.strength_exp),
        value(crime, crime.stats.defense_exp),
        value(crime, crime.stats.dexterity_exp),
        value(crime, crime.stats.agility_exp),
        value(crime, crime.stats.charisma_exp),
        value(crime, crime.stats.intelligence_exp, 5),
        currency_format(normalize(crime, crime.stats.money) * ms_per_min),
        value(crime, crime.stats.karma, 3),
        value(crime, crime.stats.hacking_success_weight, 2, false),
        value(crime, crime.stats.strength_success_weight, 2, false),
        value(crime, crime.stats.defense_success_weight, 2, false),
        value(crime, crime.stats.dexterity_success_weight, 2, false),
        value(crime, crime.stats.agility_success_weight, 2, false),
        value(crime, crime.stats.charisma_success_weight, 2, false),
      );
    }
  }, []);
}
