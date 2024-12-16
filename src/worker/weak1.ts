import { BasicHGWOptions, NS } from '@ns'
export async function main(ns: NS): Promise<void> {
  const target = String(ns.args[0]);
  const wait = Number(ns.args[1] ?? 0);
  const opts: BasicHGWOptions = {
    additionalMsec: wait,
    // Weaken does not affect stock movement
  }
  await ns.weaken(target, opts);
}
