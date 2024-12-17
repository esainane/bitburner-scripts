import { AutocompleteData, NS } from '@ns'
import { find_servers } from 'lib/find-servers';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.scripts];
}

export async function main(ns: NS): Promise<void> {
  const servers: Array<string> = find_servers(ns);


  // Copy script to all servers
  const script = String(ns.args[0]);
  if (!ns.fileExists(script)) {
    ns.tprint(`Script not found: ${script}`);
    return;
  }
  for (const target of servers) {
    ns.scp(script, target);
  }

  // Try to run scripts: Might silently fail if we don't have access
  if (ns.args[1] == '--run') {
    for (const target of servers) {
      ns.exec(script, target, 1, ...ns.args.slice(2));
    }
  } else if (ns.args[1] == '--run-threads') {
    const scriptRam = ns.getScriptRam(script);
    for (const target of servers) {
      const threads = Math.floor((ns.getServerMaxRam(target) - ns.getServerUsedRam(target)) / scriptRam);
      if (threads < 1) {
        continue;
      }
      ns.exec(script, target, threads, ...ns.args.slice(2));
    }
  }
}
