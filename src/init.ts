import { NS } from '@ns'
import { range } from '/lib/range';
import { singularity_async } from '/lib/singu';

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
  // Purchase key programs, as much as we can
  await singu.purchaseTor();
  for (const prog of ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe']) {
    await singu.purchaseProgram(prog);
  }
  // Root everything we can
  await ns.asleep(300);
  ns.exec('root.js', 'home');
  // Distribute scripts everywhere
  await ns.asleep(300);
  ns.exec('mass.js', 'home');
  await ns.asleep(300);
  // Start up the management scripts
  ns.exec('gang.js', 'home');
  // Give ourselves time to get any very easy levels before starting up the autohack scheduler
  await ns.asleep(5000);
  ns.spawn('omni.js', 1, '--quiet');
}
