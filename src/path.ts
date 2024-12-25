import { AutocompleteData, NS, Server } from '@ns'
import { singularity_async } from '/lib/singu';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return [...data.servers, '--go'];
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

export function shortest_route_to(ns: NS, target_hostname: string, start: string): string[] | undefined {
  // Traverse the network
  const seen: Set<string> = new Set();
  const target: Server = ns.getServer(target_hostname);
  if (!target) {
    ns.tprint(`ERROR Unknown server ${target_hostname}`);
    return;
  }
  const here: Server = ns.getServer(start);
  if (starting_location(target, here)) {
    // Easy case: we're already (or can immediately be) there
    return [target_hostname];
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
        return [adj_name, ...path, target_hostname];
      }
      to_visit.push({server: ns.getServer(adj_name), path: [server.hostname, ...path]});
    }
  }

  return undefined;
}

export async function main(ns: NS): Promise<void> {
  ns.ramOverride(6.25);
  if (ns.args.length < 1) {
    ns.tprint("WARNING: Usage: ./path.js SERVER [--go]");
    return;
  }
  const target_hostname = String(ns.args[0]);

  const route = shortest_route_to(ns, target_hostname, ns.getServer().hostname);

  if (!route) {
    ns.tprint('ERROR Cannot find path to ', target_hostname);
    return;
  }

  if (!ns.args.includes('--go')) {
    ns.tprint('SUCCESS ', route.join(' -> '));
    return;
  }

  const singu = singularity_async(ns);
  for (const step of route) {
    await singu.connect(step);
  }
}
