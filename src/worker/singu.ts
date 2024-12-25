import { NS, ScriptArg, Singularity } from '@ns'

export async function main(ns: NS): Promise<void> {
  const [fifo, name, ...args] = ns.args as [number, string, ...string[]];
  const handle = ns.getPortHandle(fifo);
  const singu: Singularity = ns.singularity;
  // This is both typewise extremely messy and easy to verify, so static verification gets Condo's Razor
  const func = (singu as any)[name] as CallableFunction;
  const result = await func(...args.map(d => JSON.parse(d)));
  while (!handle.tryWrite(JSON.stringify(result))) {
    await ns.asleep(200);
  }
}
