import { NS } from '@ns'
import { encode_data } from '/lib/serialize';

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
  let result;
  try {
    // If we get a result, send the result back
    result = await func(...args.map(d => JSON.parse(d)));
  } catch (e) {
    // If we got an exception, send that as the result instead
    result = e;
  }
  while (!handle.tryWrite(encode_data(result))) {
    await ns.asleep(200);
  }
}
