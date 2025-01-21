
export const default_aug_args: ReadonlyArray<string> = [
  // Prioritizing special augmentations first
  'CashRoot Starter Kit', 'Neuroreceptor Management Implant', ';',
  // Then anything which improves hacking skill
  'hskill', ';',
  // Then anything which improves hacking experience or hacking effectiveness
  'hexp', 'hack', ';',
  // Then anything which improves faction reputation gain
  'frep', ';',
  // Then anything which improves combat
  'cskill', 'cexp', ';',
  // Then everything else
  'ALL'
];
export const corp_aug_args: ReadonlyArray<string> = [
  'CashRoot Starter Kit', 'Neuroreceptor Management Implant', ';',
  // Hashes are the only way we can externally influence our corporation; 1k RP at a time for EVERY division is OP,
  // and +1b corp funds is pretty big too until the very lategame
  'hacknet', ';',
  // Faction reputation is still relevant, and hacking skill is our victory condition
  'frep', 'hskill', ';',
  // Hacking skill and power is still somewhat relevant
  'hexp', 'hack', ';',
  // Combat skill and exp is sometimes relevant
  'cskill', 'cexp', ';',
  // Everything else
  'ALL'
];
export const bladeburner_aug_args: ReadonlyArray<string> = [
  // Prioritizing special augmentations first
  // TBS is so critical it gets its own priority phase
  "The Blade's Simulacrum", ';',
  'CashRoot Starter Kit', 'Neuroreceptor Management Implant', ';',
  // Then all bladeburner augmentations
  'bladeburner', ';',
  // Then all combat augmentations
  'cskill', 'cexp', ';',
  // Hacknet rank and SP purchase is quite effective at the start of every reset. Arguably as important as combat
  // stats if we're taking a reset-heavy approach?
  'hacknet', ';',
  // Then anything which improves faction reputation gain. Should be higher if we don't have access to grafting, as
  // bladeburner faction reputation requirements are steep, and require a lot of resources without the grafting bypass.
  'frep', ';',
  // Hacking skill and performance is sometimes relevant
  'hskill', 'hexp', 'hack', ';',
  // Then everything else
  'ALL'
];
export const aug_args_by_bn: ReadonlyMap<number, ReadonlyArray<string>> = new Map<number, ReadonlyArray<string>>([
  [3, corp_aug_args],
  [6, bladeburner_aug_args],
  [7, bladeburner_aug_args],
]);


export function get_aug_args(bn: number, default_strategy=default_aug_args): ReadonlyArray<string> {
  return aug_args_by_bn.get(bn) ?? default_strategy;
}
