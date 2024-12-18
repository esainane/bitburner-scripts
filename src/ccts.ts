import { AutocompleteData, NS } from '@ns'
import { find_servers } from 'lib/find-servers';

import { CCTSolver } from 'ccts/interface';
import { contracts as known_ccts } from 'ccts/all';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.scripts.filter(s => s.endsWith('.cct')), '--desc', '--desc-unknown', '--live', '--force'];
}

function print_desc(ns: NS, filename: string, host: string | undefined, cct_type: string, data: any) {
  const desc = ns.codingcontract.getDescription(filename, host);
  ns.tprint(filename, " [", cct_type, "] @ ", host, ": ", data, '.');
  ns.tprint(desc);
}

async function attempt_cct(ns: NS, filename: string, host: string | undefined) {
  const cct_type = ns.codingcontract.getContractType(filename, host);
  const data = ns.codingcontract.getData(filename, host);
  if (ns.args.indexOf('--desc') !== -1) {
    print_desc(ns, filename, host, cct_type, data);
  }
  const solver: CCTSolver | undefined = known_ccts.get(cct_type);
  if (!solver) {
    ns.tprint("Warning: Unknown coding contract \"", cct_type, "\" in ", filename, ' @ ', host, '; ignoring.');
    if (ns.args.indexOf('--desc-unknown') !== -1) {
      print_desc(ns, filename, host, cct_type, data);
    }
    return;
  }
  const answer = solver.solve(data);
  const remaining = ns.codingcontract.getNumTriesRemaining(filename, host);
  if (ns.args.indexOf('--live') !== -1) {
    if (remaining < 3 && ns.args.indexOf('--force') === -1) {
      ns.tprint("Warning: Coding contract ", filename, " [", cct_type, "] @ ", host, ' has fewer than 3 tries (', remaining, ') remaining, not continuing without a --force.');
      ns.tprint("Would submit: ", filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer);
      return;
    }
    const result = ns.codingcontract.attempt(answer, filename, host);
    if (!result) {
      ns.tprint('CCT FAIL: ', filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer);
    } else {
      ns.tprint('CCT OK (', result, '): ', filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer)
    }
  } else {
    ns.tprint(filename, " [", cct_type, "] @ ", host, ": ", data, ' -> ', answer);
  }
}

async function find_all_ccts(ns: NS) {
  const servers = find_servers(ns);

  const all_ccts = new Array<[string, string]>();
  for (const s of servers) {
    const files: Array<string> = ns.ls(s);
    for (const f of files) {
      if (!f.endsWith('.cct')) {
        continue;
      }
      all_ccts.push([f, s]);
    }
  }

  return all_ccts;
}


export async function main(ns: NS): Promise<void> {
  if (ns.args.length > 1 && !String(ns.args[0]).startsWith('-')) {
    const filename = String(ns.args[0]);
    const host = String(ns.args[1]);
    await attempt_cct(ns, filename, host);
  } else {
    const all_ccts = await find_all_ccts(ns);
    for (const [filename, host] of all_ccts) {
      await attempt_cct(ns, filename, host);
    }
  }
}
