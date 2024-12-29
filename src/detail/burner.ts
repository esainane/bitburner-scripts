import { BladeburnerBlackOpName, NS } from '@ns'
import { colors, format_number, print_table } from '/lib/colors';
import { format_duration } from '/lib/format-duration';
import { ActionEntry, bladeburner_actions_data } from '../lib/burner';

const percent = `${colors.fg_cyan}%${colors.reset}`;

export function print_entry(ns: NS, entry: ActionEntry) {
  const required_rank = entry.type === 'Black Operations'
    ? ns.bladeburner.getBlackOpRank(entry.action as BladeburnerBlackOpName)
    : 0;
  ns.tprintf(`%s %s %s%s%s%s over %s; %s remaining; %s rep; %s rep/min`,
    `[${entry.type}]`,
    `${entry.action}${entry.level > 1
      ? `[${format_number(entry.level)}]`
      : ''}${required_rank
      ? `{${required_rank > ns.bladeburner.getRank()
        ? colors.fg_red
        : colors.fg_green}${required_rank}${colors.reset}}`
      : ''}`,
    format_number(entry.min_chance, { round: 2 }),
    percent,
    entry.min_chance === entry.max_chance ? '' : `${colors.fg_red}~${colors.reset}`,
    entry.min_chance === entry.max_chance ? '' : `${format_number(entry.max_chance, { round: 2 })}${percent}`,
    format_duration(entry.duration),
    entry.remaining > 0 ? format_number(entry.remaining, { round: 2 }) : `${colors.fg_red}none${colors.reset}`,
    format_number(entry.rep_gain, { round: 4 }),
    format_number(entry.rep_gain_per_minute, { round: 4 }),
  );
}

export async function main(ns: NS): Promise<void> {
  const actions_data = bladeburner_actions_data(ns);
  // Sort by highest expected reputation gain per minute
  actions_data.sort((l, r) => r.rep_gain_per_minute - l.rep_gain_per_minute);

  // Print relevant data
  print_table(ns, (ns: NS) => {
    for (const entry of actions_data) {
      print_entry(ns, entry);
    }
  });
}
