export async function main(ns: NS): Promise<void> {
  const target = String(ns.args[0]);
  const wait = Number(ns.args[1] ?? 0);
  await ns.sleep(wait);
  await ns.grow(target);
}