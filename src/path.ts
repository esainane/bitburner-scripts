import { AutocompleteData, NS, Server } from '@ns'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.servers];
}

/**
 * Returns true if the given server is one we can quickly start from:
 *
 * - the current server
 * - home (via the "home" command)
 * - any NPC server with a backdoor, we can directly connect to
 */
function starting_location(server: Server, here: Server): boolean {
  return server === here || server.backdoorInstalled || server.hostname === 'home';
}

export async function main(ns: NS): Promise<void> {
  const target_hostname = String(ns.args[0]);
  // Traverse the network
  const seen: Set<string> = new Set();
  const target: Server = ns.getServer(target_hostname);
  if (!target) {
    ns.tprint(`ERROR Unknown server ${target_hostname}`);
    return;
  }
  const here: Server = ns.getServer();

  if (starting_location(target, here)) {
    // Easy case: we're already (or can immediately be) there
    ns.tprint('SUCCESS ', target_hostname);
    return;
  }
  interface ServerData {
    server: Server;
    path: Array<string>;
  }
  // Work backwards from the target
  const to_visit: Array<ServerData> = [{server: target, path: []}];
  while (to_visit.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const {server, path} = to_visit.pop()!;
    if (seen.has(server.hostname)) {
      continue;
    }
    seen.add(server.hostname);
    for (const adj_name of ns.scan(server.hostname)) {
      if (seen.has(adj_name)) {
        continue;
      }
      const server = ns.getServer(adj_name);
      // Finish if we've found a path from any server we can quickly start from
      if (starting_location(server, here)) {
        ns.tprint('SUCCESS ', [adj_name, ...path, target_hostname].join(' -> '));
        return;
      }
      to_visit.push({server: ns.getServer(adj_name), path: [server.hostname, ...path]});
    }
  }
  ns.tprint('ERROR Cannot find path to ', target_hostname);
}
