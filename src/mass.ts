import { AutocompleteData, NS } from '@ns'
import { find_servers } from 'lib/find-servers';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.scripts, '--run', '--run-threads', '--no-lib'];
}

export async function main(ns: NS): Promise<void> {
  const servers: Array<string> = find_servers(ns);

  const p_args = ns.args.map(String).filter(d => !d.startsWith('-'));
  // Copy script to all servers
  // First copy everything in lib/ unless expressly requested otherwise
  if (ns.args.indexOf('--no-lib') === -1) {
    const libs = ns.ls('home').filter(d=>d.startsWith('lib/'));
    for (const file of libs) {
      for (const target of servers) {
        ns.scp(file, target);
      }
    }
  }
  // Then the listed scripts
  const scripts = p_args;
  for (const script in scripts) {
    if (!ns.fileExists(script)) {
      ns.tprint(`Script not found: ${script}`);
      return;
    }
    for (const target of servers) {
      ns.scp(script, target);
    }

    // Try to run listed scripts if requested: Might silently fail if we don't have access
    if (ns.args.indexOf('--run') !== -1) {
      for (const target of servers) {
        ns.exec(script, target, 1, ...ns.args.slice(2));
      }
    } else if (ns.args.indexOf('--run-threads') !== -1) {
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
}
