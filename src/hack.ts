export async function main(ns: NS): Promise<void> {
  const target = String(ns.args[0]);
  while (true) {
    await ns.hack(target);
  }
}