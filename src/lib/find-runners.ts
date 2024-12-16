import { NS, ProcessInfo } from '@ns'

export interface Runner { server: string, threads: number }

export interface RunnersData {
  available_runners: Array<Runner>;
  available_threads: number;
}

export async function find_runners(ns: NS, servers: Array<string>, script: string, exclude_runners: Set<string> = new Set(), ignore_scripts: null | ((process: ProcessInfo) => boolean) = null): Promise<RunnersData> {
  const available_runners: Array<Runner> = [];
  let total_available_threads = 0;

  const ram_per_thread = ns.getScriptRam(script, 'home');

  for (const s of servers) {
    if (!ns.hasRootAccess(s)) {
      continue;
    }
    if (exclude_runners.has(s)) {
      continue;
    }
    let ignored_used_ram = 0;
    if (ignore_scripts) {
      for (const process of ns.ps()) {
        if (ignore_scripts(process)) {
          ignored_used_ram += process.threads * ns.getScriptRam(process.filename, s);
        }
      }
    }
    const server_available_threads = Math.floor((ns.getServerMaxRam(s) - ns.getServerUsedRam(s) + ignored_used_ram) / ram_per_thread);
    if (server_available_threads < 1) {
      continue;
    }
    available_runners.push({server: s, threads: server_available_threads});
    total_available_threads += server_available_threads;
  }

  return {available_runners, available_threads: total_available_threads};
}
