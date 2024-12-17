import { NS } from '@ns'
import { find_servers } from 'lib/find-servers';

export async function main(ns: NS): Promise<void> {
  const servers = find_servers(ns).filter((d: string) => d !== 'home' && d !== 'darkweb');

  const ignore_files = new Set<string>(ns.ls('home'));
  const all_files = new Map<string, string[]>([]);
  for (const s of servers) {
    const files: Array<string> = ns.ls(s);
    for (const f of files) {
      if (all_files.has(f)) {
        all_files.get(f)!.push(s);
      } else {
        all_files.set(f, [s]);
      }
    }
  }

  for (const [f, servers] of [...all_files.entries()].filter(([d, v]) => !d.endsWith('.lit') && !ignore_files.has(d))) {
    ns.tprint(f, ' @ ', servers);
  }
}
