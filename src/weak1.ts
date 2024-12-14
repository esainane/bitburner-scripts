export async function main(ns: NS) {
  const target: string = String(ns.args[0]);
  const wait: number = Number(ns.args[1] ?? 0);
  await ns.sleep(wait);
  await ns.weaken(target);
}