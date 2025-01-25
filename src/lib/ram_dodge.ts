import { NS } from '@ns';
import { mkfifo } from '/lib/mkfifo';
import { ThreadAllocator } from '/lib/thread-allocator';
import { decode_data } from '/lib/serialize';

// Small helper for offloading extremely high ram cost functions to serially distinct scripts:
// - exec a helper script
// - read the result from a pipe
// - return the result

export async function worker_dispatch(ns: NS, name: string, ...args: any[]) {
  const fifo = mkfifo(ns);
  const options = {
    threads: 1,
    ramOverride: ns.getScriptRam('worker/dodge.js', 'home')
      + ns.getFunctionRamCost(name)
  };
  do {
    const allocator = new ThreadAllocator(ns, new Set(), new Set()).getAllocator();
    const [unallocable, pids] = await allocator('worker/dodge.js', options, false, fifo, name, ...args.map(d => JSON.stringify(d)));
    if (unallocable) {
      await ns.asleep(450);
    } else {
      //ns.tprint(`Dispatched worker successfully, ${unallocable} unallocable, ${JSON.stringify(pids)} pids`);
      break;
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);
  const handle = ns.getPortHandle(fifo);
  if (handle.empty()) {
    await handle.nextWrite();
  }
  const data = await handle.read();
  const result = decode_data(data);
  if (result instanceof Error) {
    throw result;
  }
  return result;
}
