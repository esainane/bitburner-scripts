export async function main(ns: NS) {
  const target: string = String(ns.args[0]);
  while (true) {
    await ns.hack(target);
  }
}