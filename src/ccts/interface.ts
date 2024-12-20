import { AutocompleteData, NS } from '@ns';
import { colors, format_data } from '/lib/colors';

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

export function test_dummy_all(ns: NS, contracts: Map<string, CCTSolver>, verbose=true): Counterexample[] {
  const counterexamples: Counterexample[] = [];
  for (const [type, solver] of contracts) {
    const ce = test_dummy(ns, type, solver, verbose);
    if (ce) {
      counterexamples.push(ce);
    }
  }
  return counterexamples;
}

export function test_dummy(ns: NS, type: string, solver: CCTSolver, verbose=true): Counterexample | undefined {
  const fname = ns.codingcontract.createDummyContract(type);
  if (!type) {
    ns.tprint('ERROR Could not create dummy contract!');
    return;
  }
  const data = ns.codingcontract.getData(fname);
  const answer = solver.solve(data);
  // Dummy contracts are always created on the home server
  let ok;
  try {
    ok = ns.codingcontract.attempt(answer, fname, 'home');
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
    const desc = ns.codingcontract.getDescription(fname);
    ns.tprint(desc);
  }
  return { type, input: data, filename: fname, actual: answer };
}

export function autocomplete_func(data: AutocompleteData, args: string[]): string[] {
  return ['--generated', '--test', '--desc', '--quiet'];
}

export function ccts_main(contracts: Map<string, CCTSolver>): (ns: NS) => Promise<void> {
  return async function main(ns: NS): Promise<void> {
    if (ns.args.includes('--test') || ns.args.includes('--generated')) {
      // Use generated ccts
      test_dummy_all(ns, contracts, !ns.args.includes('--quiet'));
      // If told to --test, do both generated and self-tests
      if (!ns.args.includes('--test')) {
        return;
      }
    } else if (ns.args.includes('--desc')) {
      // Get descriptions for all contracts
      for (const [type, solver] of contracts) {
        ns.tprint(`${type}:`);
        const fname = ns.codingcontract.createDummyContract(type);
        ns.tprint(ns.codingcontract.getDescription(fname, 'home'));
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
