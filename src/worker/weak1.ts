import { BasicHGWOptions, NS } from '@ns'
import { format_duration } from 'lib/format-duration';
import { format_number, format_servername } from 'lib/colors';

export async function main(ns: NS): Promise<void> {
  const target = String(ns.args[0]);
  const wait = Number(ns.args[1] ?? 0);
  if (wait < -1e-3) {
    ns.tprint(`WARNING: large negative wait time ${format_duration(wait)} time for weaken(${format_servername(target, {is_warning: true})}), setting to ${format_number(0)}`);
  }
  const opts: BasicHGWOptions = {
    additionalMsec: wait < 0 ? 0 : wait,
    // Weaken does not affect stock movement
  }
  if (ns.args.includes('--loop')) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await ns.weaken(target, opts);
    }
  }
  const floop = ns.args.map(String).find(d => d.startsWith('--loop='));
  if (floop) {
    const loop = Number(floop.split('=')[1]);
    for (let i = 0; i < loop; i++) {
      await ns.weaken(target, opts);
    }
    return;
  }
  await ns.weaken(target, opts);
}
