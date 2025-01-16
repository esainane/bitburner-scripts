import { NS } from '@ns'

export function panic(ns: NS, what: string): never {
  ns.tprint(`ERROR ${what}`);
  throw new Error(what);
}
