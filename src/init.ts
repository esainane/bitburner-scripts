import { NS } from '@ns'
import { range } from '/lib/range';
import { singularity_async } from '/lib/singu';
import { SingularityAsync } from './lib/dodge-interfaces/singu-interface';

async function purchase_key_programs(ns: NS, singu: SingularityAsync): Promise<void> {
  // Purchase key programs, as much as we can
  await singu.purchaseTor();
  for (const prog of ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe']) {
    await singu.purchaseProgram(prog);
  }
}

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(26.25);
  const singu = singularity_async(ns);
  // Set the player to study
  await singu.universityCourse('Rothman University', 'Algorithms', false);
  // Set all sleeves to study, or Synchronize/Shock recover if applicable
  const sleeve_count = ns.sleeve.getNumSleeves();
  for (const i of range(sleeve_count)) {
    const sleeve = ns.sleeve.getSleeve(i);
    if (sleeve) {
      // Synchronize first
      if (sleeve.sync < 100) {
        ns.sleeve.setToSynchronize(i);
        continue;
      }
      // Recover from shock if fully synchonized
      if (sleeve.shock > 0) {
        ns.sleeve.setToShockRecovery(i);
        continue;
      }
      // Otherwise, get studying
      ns.sleeve.setToUniversityCourse(i, 'Rothman University', 'Algorithms');
    }
  }

  // In case we don't have sources of ongoing income (gang, corp), we must ensure starting funds for key programs first
  await purchase_key_programs(ns, singu);

  // Distribute scripts everywhere
  await ns.asleep(300);
  ns.exec('mass.js', 'home');
  await ns.asleep(300);
  // Start up the management scripts
  ns.exec('gang.js', 'home');
  if (ns.corporation.hasCorporation()) {
    ns.exec('corp.js', 'home');
    ns.exec('hacknet.js', 'home', 1, '--corp');
  } else {
    // Conservative-ish configuration: any upgrade which pays for itself in an hour and a half
    // There really should be a sliding window option based on how long it has been since soft reset
    ns.exec('hacknet.js', 'home', 1, 5400);
  }

  // Give ourselves time to get any very easy levels before starting up the autohack scheduler
  await ns.asleep(10000);

  // In case we do have access to ongoing income, try to buy everything again after we've had time for a cycle or two
  await purchase_key_programs(ns, singu);

  // Root everything we can
  ns.exec('root.js', 'home');

  // Finally, start up autohacking
  await ns.asleep(300);
  ns.spawn('omni.js', 1, '--quiet');
}
