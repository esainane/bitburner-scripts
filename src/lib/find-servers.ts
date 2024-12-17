import { NS } from '@ns'

export function find_servers(ns: NS): Array<string> {
  // Traverse the network
  const seen: Set<string> = new Set();
  const to_visit: Array<string> = ['home'];
  while (to_visit.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const s: string = to_visit.pop()!;
    if (seen.has(s)) {
      continue;
    }
    seen.add(s);
    for (const adj_name of ns.scan(s)) {
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push(adj_name);
    }
  }

  const servers: Array<string> = [...seen.values()];
  return servers;
}
