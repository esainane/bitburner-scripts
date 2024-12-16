import { NS } from '@ns'
export async function main(ns: NS): Promise<void> {
  if (ns.args.indexOf('--loop') !== -1) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await ns.share();
    }
  }
  await ns.share();
}
