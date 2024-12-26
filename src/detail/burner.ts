import { BladeburnerActionName, BladeburnerActionType, NS } from '@ns'
import { colors, format_number, print_table } from '/lib/colors';
import { format_duration } from '/lib/format-duration';

const ms_per_sec = 1000;
const ms_per_min = 60 * ms_per_sec;

interface ActionEntry {
  type: BladeburnerActionType | `${BladeburnerActionType}`;
  action: BladeburnerActionName | `${BladeburnerActionName}`;
  level: number;
  min_chance: number;
  max_chance: number;
  duration: number;
  remaining: number;
  rep_gain: number;
  rep_gain_per_minute: number;
}

const percent = `${colors.fg_cyan}%${colors.reset}`;

function print_entry(ns: NS, entry: ActionEntry) {
  ns.tprintf(`%s %s %s%s%s%s over %s; %s remaining; %s rep; %s rep/min`,
    `[${entry.type}]`,
    `${entry.action}${entry.level > 1 ? `[${format_number(entry.level)}]` : ''})`,
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
  type Action = [BladeburnerActionType | `${BladeburnerActionType}`, BladeburnerActionName | `${BladeburnerActionName}`];
  type ActionList = Action[];
  // Using enums directly, eg BladeburnerActionType.BlackOp, will cause the @ns import to be emitted, causing a failure
  // when run in bitburner. So we directly use the string representation instead.
  const general_actions: ActionList = ns.bladeburner.getGeneralActionNames().map(d => ['General', d]);
  const contract_actions: ActionList = ns.bladeburner.getContractNames().map(d => ['Contracts', d]);
  const operation_actions: ActionList = ns.bladeburner.getOperationNames().map(d => ['Operations', d]);
  const blackops_actions: ActionList = ns.bladeburner.getBlackOpNames().map(d => ['Black Operations', d]);
  const actions: ActionList = [
    ...general_actions,
    ...contract_actions,
    ...operation_actions,
    ...blackops_actions,
  ];

  const team_size_available = ns.bladeburner.getTeamSize();
  // Ensure we use the maximum team size for all relevant operations
  for (const [type, action] of actions) {
    // Only ops and blackops use teams
    if (!['Operations', 'Black Operations'].includes(type)) {
      continue;
    }
    const team_size = ns.bladeburner.getTeamSize(type, action);
    if (team_size < team_size_available) {
      ns.bladeburner.setTeamSize(type, action, team_size_available);
    }
  }

  const actions_data = actions.map(([type, action]) => {
    // General and Black Operations tasks do not have levels
    const level = ['General', 'Black Operations'].includes(type) ? 0 : ns.bladeburner.getActionCurrentLevel(type, action);
    const [min_chance, max_chance] = ns.bladeburner.getActionEstimatedSuccessChance(type, action).map(d => d * 100);
    const expected_chance = (min_chance + max_chance) / 2;
    const duration = ns.bladeburner.getActionTime(type, action);
    const remaining = ns.bladeburner.getActionCountRemaining(type, action);
    const rep_gain = ns.bladeburner.getActionRepGain(type, action);
    const rep_gain_per_minute = rep_gain * expected_chance / 100 / duration * ms_per_min;
    return {
      type,
      action,
      level,
      min_chance,
      max_chance,
      duration,
      remaining,
      rep_gain,
      rep_gain_per_minute,
    };
  });

  // Sort by highest expected reputation gain per minute
  actions_data.sort((l, r) => r.rep_gain_per_minute - l.rep_gain_per_minute);

  // Print relevant data
  print_table(ns, (ns: NS) => {
    for (const entry of actions_data) {
      print_entry(ns, entry);
    }
  });
}
