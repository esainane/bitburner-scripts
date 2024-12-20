import { NS } from '@ns'
export async function main(ns: NS): Promise<void> {
  if (ns.args.includes('--loop')) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await ns.share();
    }
  }
  await ns.share();
}
