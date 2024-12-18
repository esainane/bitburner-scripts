import { NS } from '@ns';

export type CCTSolver =
  (data: unknown) => string | number | unknown[];

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
  const answer = solver(data);
  // Dummy contracts are always created on the home server
  const ok = ns.codingcontract.attempt(answer, fname, 'home');
  if (ok) {
    if (verbose) {
      ns.tprint(`SUCCESS {${type}} Dummy contract: [${fname}]: ${data} -> `, answer);
    }
    return;
  }
  if (verbose) {
    ns.tprint(`WARNING {${type}} Dummy contract solver failed: [${fname}]: ${data} -> `, answer);
    const desc = ns.codingcontract.getDescription(fname);
    ns.tprint(desc);
  }
  return { type, input: data, filename: fname, actual: answer };
}
