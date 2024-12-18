import { AutocompleteData, NS } from '@ns'
import { find_servers } from 'lib/find-servers';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.scripts, '--', '--run', '--run-threads', '--run-threads=', '--no-lib'];
}

export async function main(ns: NS): Promise<void> {
  // Format: mass.ts [script1 script2 ...] [--run] [--run-threads[=N]] [--no-lib] [-- args...]
  const servers: Array<string> = find_servers(ns);

  const args_sep = ns.args.indexOf('--');
  const our_args = ns.args.slice(0, args_sep === -1 ? undefined : args_sep);
  const run_args = ns.args.slice(args_sep + 1);
  const p_args = our_args.map(String).filter(d => !d.startsWith('-'));

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
  const do_run = our_args.indexOf('--run') !== -1;
  const do_run_threads = our_args.map(d => String(d)).find((d) => d.startsWith('--run-threads'));
  const do_run_threads_count = do_run_threads && do_run_threads.includes('=') ? Number(do_run_threads.split('=')[1]) : 0;
  for (const script of scripts) {
    if (!ns.fileExists(script)) {
      ns.tprint(`Script not found: ${script}`);
      return;
    }
    for (const target of servers) {
      ns.scp(script, target);
    }

    // Try to run listed scripts if requested: Might silently fail if we don't have access
    if (do_run) {
      for (const target of servers) {
        ns.exec(script, target, 1, ...run_args);
      }
    } else if (do_run_threads) {
      if (do_run_threads_count > 0) {
        for (const target of servers) {
          ns.exec(script, target, do_run_threads_count, ...run_args);
        }
        continue;
      }
      const scriptRam = ns.getScriptRam(script);
      for (const target of servers) {
        const threads = Math.floor((ns.getServerMaxRam(target) - ns.getServerUsedRam(target)) / scriptRam);
        if (threads < 1) {
          continue;
        }
        ns.exec(script, target, threads, ...run_args);
      }
    }
  }
}
