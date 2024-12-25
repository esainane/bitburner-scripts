import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  ns.singularity.universityCourse('Rothman University', 'Algorithms');
  ns.singularity.purchaseTor();
  for (const prog of ['FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe']) {
    ns.singularity.purchaseProgram(prog);
  }
  await ns.asleep(300);
  ns.exec('root.js', 'home');
  await ns.asleep(300);
  ns.exec('mass.js', 'home');
  await ns.asleep(300);
  ns.exec('gang.js', 'home');
  await ns.asleep(5000);
  ns.spawn('omni.js', 1, '--quiet');
}
