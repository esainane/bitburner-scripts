import { NS, BladeburnerActionType, BladeburnerActionName } from '@ns';
import { ms_per_min } from './consts';

export type Action = [BladeburnerActionType | `${BladeburnerActionType}`, BladeburnerActionName | `${BladeburnerActionName}`];
export type ActionList = Action[];

export interface ActionEntry {
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

export function bladeburner_actions_data(ns: NS, all_blackops=true): ActionEntry[] {
  // Using enums directly, eg BladeburnerActionType.BlackOp, will cause the @ns import to be emitted, causing a failure
  // when run in bitburner. So we directly use the string representation instead.
  const general_actions: ActionList = ns.bladeburner.getGeneralActionNames().map(d => ['General', d]);
  const contract_actions: ActionList = ns.bladeburner.getContractNames().map(d => ['Contracts', d]);
  const operation_actions: ActionList = ns.bladeburner.getOperationNames().map(d => ['Operations', d]);
  const next_black_op = ns.bladeburner.getNextBlackOp();
  const blackops_actions: ActionList = all_blackops
    ? ns.bladeburner.getBlackOpNames().map(d => ['Black Operations', d])
    : next_black_op
      ? [['Black Operations', next_black_op.name]]
      : [];
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

  return actions_data;
}
