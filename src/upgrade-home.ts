import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  // To avoid expensive singularity function calls, don't use upgradeHomeRamCost.
  // Just keep trying to upgrade until it fails.
  while (ns.singularity.upgradeHomeRam()) {
    ns.asleep(100);
  }
}
