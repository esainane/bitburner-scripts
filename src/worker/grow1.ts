import { BasicHGWOptions, NS } from '@ns'
import { format_duration } from '/lib/format-duration';
import { format_number, format_servername } from '/lib/colors';
export async function main(ns: NS): Promise<void> {
  const target = String(ns.args[0]);
  const wait = Number(ns.args[1] ?? 0);
  if (wait < -1e-3) {
    ns.tprint(`WARNING: large negative wait time ${format_duration(wait)} time for grow(${format_servername(target, {is_warning: true})}), setting to ${format_number(0)}`);
  }
  const opts: BasicHGWOptions = {
    additionalMsec: wait < 0 ? 0 : wait,
    // TODO: Check state once we can both long and short
    stock: true, // ns.args.includes("--long"),
  }
  await ns.grow(target, opts);
}
