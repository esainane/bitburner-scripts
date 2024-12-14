import { NS } from '@ns'
import { find_servers } from 'lib/find-servers';
export async function main(ns: NS): Promise<void> {
  // Copy script to all available servers
  const servers: Array<Server> = (await find_servers(ns)).filter(s => s.hasAdminRights);

  // Copy script to all
  const script = String(ns.args[0]);
  for (const target of servers) {
    ns.scp(script, target.hostname);
  }

  if (ns.args[1] == '--run') {
    for (const target of servers) {
      ns.exec(script, target.hostname, 1, ...ns.args.slice(2));
    }
  } else if (ns.args[1] == '--run-threads') {
    const scriptRam = ns.getScriptRam(script);
    for (const target of servers) {
      const threads = Math.floor((target.maxRam - target.ramUsed) / scriptRam);
      if (threads < 1) {
        continue;
      }
      ns.exec(script, target.hostname, threads, ...ns.args.slice(2));
    }
  }
}
