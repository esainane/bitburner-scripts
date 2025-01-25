import { AutocompleteData, NS } from '@ns';
import { colors, format_data } from '/lib/colors';
import { CodingContractAsync } from '/lib/dodge-interfaces/cct';
import { codingcontract_async } from '/lib/dodge/cct';

export type CCTResult = string | number | unknown[];

export interface CCTSolver {
  solve: (data: unknown) => CCTResult;
  test: (ns: NS) => void;
}

export interface Counterexample {
  type: string;
  input: unknown;
  filename: string;
  actual: string | number | unknown[];
}

export async function test_dummy_all(ns: NS, codingcontract: CodingContractAsync, contracts: Map<string, CCTSolver>, verbose=true): Promise<Counterexample[]> {
  const counterexamples: Counterexample[] = [];
  for (const [type, solver] of contracts) {
    const ce = await test_dummy(ns, codingcontract, type, solver, verbose);
    if (ce) {
      counterexamples.push(ce);
    }
  }
  return counterexamples;
}

export async function test_dummy(ns: NS, codingcontract: CodingContractAsync, type: string, solver: CCTSolver, verbose=true): Promise<Counterexample | undefined> {
  const fname = await codingcontract.dodge_createDummyContract(type);
  if (!type) {
    ns.tprint('ERROR Could not create dummy contract!');
    return;
  }
  const data = await codingcontract.dodge_getData(fname);
  const answer = solver.solve(data);
  // Dummy contracts are always created on the home server
  let ok;
  try {
    ok = await codingcontract.dodge_attempt(answer, fname, 'home');
  } catch (e) {
    ns.tprint(`ERROR {${colors.fg_cyan}${type}${colors.reset}} Dummy contract solver raised exception: [${fname}]: ${format_data(data)} -> ${format_data(answer, {abbrev: true})}: ${e}`);
    console.log('Exception in coding contract', type, 'data:', data, answer);
    return { type, input: data, filename: fname, actual: answer };
  }
  if (ok) {
    if (verbose) {
      ns.tprint(`SUCCESS {${colors.fg_cyan}${type}${colors.reset}} Dummy contract: [${fname}]: ${format_data(data)} -> ${format_data(answer, {abbrev:true})}`);
    }
    return;
  }
  if (verbose) {
    ns.tprint(`ERROR {${colors.fg_cyan}${type}${colors.reset}} Dummy contract solver failed: [${fname}]: ${format_data(data)} -> ${format_data(answer, {abbrev:true})}`);
    console.log('Failed coding contract', type, 'data:', data, answer);
    const desc = await codingcontract.dodge_getDescription(fname);
    ns.tprint(desc);
  }
  return { type, input: data, filename: fname, actual: answer };
}

export function autocomplete_func(data: AutocompleteData, args: string[]): string[] {
  return ['--generated', '--test', '--desc', '--quiet'];
}

export function ccts_main(contracts: Map<string, CCTSolver>): (ns: NS) => Promise<void> {
  return async function main(ns: NS): Promise<void> {
    const codingcontract = codingcontract_async(ns);
    if (ns.args.includes('--test') || ns.args.includes('--generated')) {
      // Use generated ccts
      test_dummy_all(ns, codingcontract, contracts, !ns.args.includes('--quiet'));
      // If told to --test, do both generated and self-tests
      if (!ns.args.includes('--test')) {
        return;
      }
    } else if (ns.args.includes('--desc')) {
      // Get descriptions for all contracts
      for (const [type, solver] of contracts) {
        ns.tprint(`${type}:`);
        const fname = await codingcontract.dodge_createDummyContract(type);
        ns.tprint(await codingcontract.dodge_getDescription(fname, 'home'));
        ns.rm(fname, 'home');
      }
      return;
    }
    // Otherwise, use self-tests
    for (const [type, solver] of contracts) {
      ns.tprint(`{${colors.fg_cyan}${type}${colors.reset}}`);
      solver.test(ns);
    }
  }
}
