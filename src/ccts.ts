import { AutocompleteData, NS } from '@ns'
import { find_servers } from 'lib/find-servers';

import { CCTResult, CCTSolver } from 'ccts/interface';
import { contracts as known_ccts } from 'ccts/all';
import { colors, format_data, format_number, format_servername } from '/lib/colors';
import { format_duration } from '/lib/format-duration';
import { format } from 'path';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.scripts.filter(s => s.endsWith('.cct')), '--desc', '--desc-unknown', '--live', '--force'];
}

function print_desc(ns: NS, filename: string, host: string | undefined, cct_type: string, data: unknown) {
  const desc = ns.codingcontract.getDescription(filename, host);
  ns.tprint(`${format_cct(filename, host, cct_type)}: ${format_data(data)}`);
  ns.tprint(desc);
}

function format_cct(filename: string, host: string | undefined, cct_type: string, { is_warning = false } = {}) {
  const server = host ?? 'home';
  return `[${colors.fg_cyan}${cct_type}${colors.reset}] @ ${format_servername(server, { is_warning })}/${filename} `;
}

function format_cct_result(data: unknown, result: CCTResult) {
  return `${format_data(data)} -> ${format_data(result)}`;
}

async function attempt_cct(ns: NS, filename: string, host: string | undefined) {
  const server = host ?? 'home';
  const cct_type = ns.codingcontract.getContractType(filename, server);
  const data = ns.codingcontract.getData(filename, server);
  if (ns.args.indexOf('--desc') !== -1) {
    print_desc(ns, filename, server, cct_type, data);
  }
  const solver: CCTSolver | undefined = known_ccts.get(cct_type);
  if (!solver) {
    ns.tprint(`WARNING Unknown coding contract ${format_cct(filename, host, cct_type, { is_warning: true })}; ignoring.`);
    if (ns.args.indexOf('--desc-unknown') !== -1) {
      print_desc(ns, filename, server, cct_type, data);
    }
    return;
  }
  const answer = solver.solve(data);
  const remaining = ns.codingcontract.getNumTriesRemaining(filename, server);
  if (ns.args.indexOf('--live') !== -1) {
    if (remaining < 3 && ns.args.indexOf('--force') === -1) {
      ns.tprint(`WARNING Coding contract ${format_cct(filename, host, cct_type, { is_warning: true })} has fewer than 3 tries (${format_number(remaining)}) remaining, not continuing without a ${colors.fg_cyan}--force.${colors.reset}`);
      ns.tprint(`INFO Would submit: ${format_cct(filename, host, cct_type)}: ${format_cct_result(data, answer)}`);
      return;
    }
    const result = ns.codingcontract.attempt(answer, filename, server);
    if (!result) {
      ns.tprint(`ERROR CCT FAIL: ${format_cct(filename, host, cct_type)}: ${format_cct_result(data, answer)}`);
    } else {
      ns.tprint(`SUCCESS CCT OK (${colors.fg_cyan}${result}${colors.reset}): ${format_cct(filename, host, cct_type)}: ${format_cct_result(data, answer)}`)
    }
  } else {
    ns.tprint(`${format_cct(filename, host, cct_type)}: ${format_cct_result(data, answer)}`);
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
  if (ns.args.includes('--test')) {
    ns.spawn('ccts/all.js', 1, '--test');
    return;
  }
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
