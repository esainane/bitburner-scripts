import { NS, ScriptArg, Singularity } from '@ns'

export async function main(ns: NS): Promise<void> {
  const [fifo, name, ...args] = ns.args as [number, string, ...string[]];
  const handle = ns.getPortHandle(fifo);
  const path = name.split('.');
  let lookup: any = ns;
  while (path.length > 0) {
    const key = path.shift()!;
    lookup = lookup[key];
  }
  // This is both typewise extremely messy and easy to verify, so static verification gets Condo's Razor
  const func = lookup as CallableFunction;
  const result = await func(...args.map(d => JSON.parse(d)));
  while (!handle.tryWrite(JSON.stringify(result))) {
    await ns.asleep(200);
  }
}
