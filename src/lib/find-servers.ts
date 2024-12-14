import { NS } from '@ns'

export async function find_servers(ns: NS): Promise<Array<string>> {
  // Traverse the network
  const seen: Set<string> = new Set();
  const to_visit: Array<string> = ['home'];
  while (to_visit.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const s: string = to_visit.pop()!;
    if (seen.has(s.hostname)) {
      continue;
    }
    seen.add(s.hostname);
    for (const adj_name of ns.scan(s.hostname)) {
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push(adj_name);
    }
  }

  const servers: Array<Server> = [...seen.values()];
  return servers;
}
