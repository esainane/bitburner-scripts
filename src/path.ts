import { AutocompleteData, NS, Server } from '@ns'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.servers];
}

export async function main(ns: NS): Promise<void> {
  const target = String(ns.args[0]);
  // Traverse the network
  const seen: Set<string> = new Set();
  const home: Server = ns.getServer('home');
  interface ServerData {
    server: Server;
    path: Array<string>;
  }
  const to_visit: Array<ServerData> = [{server: home, path: []}];
  while (to_visit.length > 0) {
    const {server, path} = to_visit.pop()!;
    if (seen.has(server.hostname)) {
      continue;
    }
    seen.add(server.hostname);
    for (const adj_name of ns.scan(server.hostname)) {
      if (adj_name == target) {
        ns.tprint([...path, server.hostname, adj_name].join(' -> '));
        return;
      }
      if (seen.has(adj_name)) {
        continue;
      }
      to_visit.push({server: ns.getServer(adj_name), path: [...path, server.hostname]});
    }
  }
}
