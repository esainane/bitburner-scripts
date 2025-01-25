import { AutocompleteData, NS } from '@ns'
import { find_servers } from 'lib/find-servers';

import { CCTResult, CCTSolver } from 'ccts/interface';
import { contracts as known_ccts } from 'ccts/all';
import { colors, format_data, format_number, format_servername } from '/lib/colors';
import { codingcontract_async } from '/lib/dodge/cct';
import { CodingContractAsync } from '/lib/dodge-interfaces/cct';
import { main as test_all_main } from 'ccts/all';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.scripts.filter(s => s.endsWith('.cct')), '--desc', '--desc-unknown', '--live', '--force'];
}

async function print_desc(ns: NS, codingcontract: CodingContractAsync, filename: string, host: string | undefined, cct_type: string, data: unknown) {
  const desc = await codingcontract.dodge_getDescription(filename, host);
  ns.tprint(`${format_cct(filename, host, cct_type)}: ${format_data(data)}`);
  ns.tprint(desc);
}

function format_cct(filename: string, host: string | undefined, cct_type: string, { is_warning = false } = {}) {
  const server = host ?? 'home';
  return `[${colors.fg_cyan}${cct_type}${colors.reset}] @ ${format_servername(server, { is_warning })}/${filename}`;
}

function format_cct_result(data: unknown, result: CCTResult) {
  return `${format_data(data)} -> ${format_data(result, {abbrev: true})}`;
}

// Naughty global state
// Tracks unknown CCT types, printing one example for each at the end, so we avoid spamming the same description
const unknowns: Map<string, [string, string]> = new Map();

async function attempt_cct(ns: NS, codingcontract: CodingContractAsync, filename: string, host: string | undefined) {
  const server = host ?? 'home';
  const cct_type = await codingcontract.dodge_getContractType(filename, server);
  const data = await codingcontract.dodge_getData(filename, server);
  if (ns.args.includes('--desc')) {
    await print_desc(ns, codingcontract, filename, server, cct_type, data);
  }
  const solver: CCTSolver | undefined = known_ccts.get(cct_type);
  if (!solver) {
    if (ns.args.includes('--desc-unknown')) {
      unknowns.set(cct_type, [filename, server]);
    } else {
      ns.tprint(`WARNING Unknown coding contract ${format_cct(filename, host, cct_type, { is_warning: true })}; ignoring.`);
    }
    return;
  }
  const answer = solver.solve(data);
  const remaining = await codingcontract.dodge_getNumTriesRemaining(filename, server);
  if (ns.args.includes('--live')) {
    if (remaining < 3 && !ns.args.includes('--force')) {
      ns.tprint(`WARNING Coding contract ${format_cct(filename, host, cct_type, { is_warning: true })} has fewer than 3 tries (${format_number(remaining)}) remaining, not continuing without a ${colors.fg_cyan}--force.${colors.reset}`);
      ns.tprint(`INFO Would submit: ${format_cct(filename, host, cct_type)}: ${format_cct_result(data, answer)}`);
      return;
    }
    const result = await codingcontract.dodge_attempt(answer, filename, server);
    if (!result) {
      ns.tprint(`ERROR CCT FAIL: ${format_cct(filename, host, cct_type)}: ${format_cct_result(data, answer)}`);
      console.log('Failed coding contract', cct_type, 'data:', data, answer);
    } else {
      ns.tprint(`SUCCESS CCT OK (${colors.fg_magenta}${result}${colors.reset}): ${format_cct(filename, host, cct_type)}: ${format_cct_result(data, answer)}`)
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
    return await test_all_main(ns);
  }
  const codingcontract = codingcontract_async(ns);
  if (ns.args.length > 1 && !String(ns.args[0]).startsWith('-')) {
    const filename = String(ns.args[0]);
    const host = String(ns.args[1]);
    await attempt_cct(ns, codingcontract, filename, host);
  } else {
    const all_ccts = await find_all_ccts(ns);
    for (const [filename, host] of all_ccts) {
      await attempt_cct(ns, codingcontract, filename, host);
    }
  }
  if (ns.args.includes('--desc-unknown')) {
    for (const [type, [filename, server]] of unknowns.entries()) {
      ns.tprint(`WARNING Unknown coding contract: ${format_cct(filename, server, type, { is_warning: true })}`);
      await print_desc(ns, codingcontract, filename, server, type, await codingcontract.dodge_getData(filename, server));
    }
    unknowns.clear();
  }
}
