import { NS, ProcessInfo } from '@ns'

export interface Runner {
  server: string;
  threads: number;
  max_ram: number;
  used_ram: number;
}

export interface RunnersData {
  available_runners: Array<Runner>;
  available_threads: number;
}

export function recalculate_threads(ns: NS, runners: Array<Runner>, script: string): number {
  let sum = 0;
  for (const r of runners) {
    const amount = Math.floor((r.max_ram - r.used_ram) / ns.getScriptRam(script, 'home'));
    sum += amount;
    r.threads = amount;
  }
  return sum;
}

export function find_runners(ns: NS, servers: Array<string>, script: string, exclude_runners: Set<string> = new Set(), ignore_scripts: null | ((process: ProcessInfo) => boolean) = null): RunnersData {
  const available_runners: Array<Runner> = [];
  let total_available_threads = 0;

  const ram_per_thread = ns.getScriptRam(script, 'home');

  for (const s of servers) {
    if (!ns.hasRootAccess(s)) {
      continue;
    }
    let reserved = 0;
    if (exclude_runners.has(s)) {
      if (s != 'home') {
        continue;
      }
      // Spare a little from home
      // FIXME: What a hack
      reserved = 82;
    }
    let ignored_used_ram = 0;
    if (ignore_scripts) {
      for (const process of ns.ps(s)) {
        if (ignore_scripts(process)) {
          ignored_used_ram += process.threads * ns.getScriptRam(process.filename, s);
        }
      }
    }
    const [ max_ram, used_ram ] = [ ns.getServerMaxRam(s) - reserved, ns.getServerUsedRam(s) ];
    const server_available_threads = Math.floor((max_ram - used_ram + ignored_used_ram) / ram_per_thread);
    if (server_available_threads < 1) {
      continue;
    }
    available_runners.push({server: s, threads: server_available_threads, max_ram, used_ram });
    total_available_threads += server_available_threads;
  }

  return {available_runners, available_threads: total_available_threads};
}
