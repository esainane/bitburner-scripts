import { NS } from '@ns'

import { find_servers } from 'lib/find-servers'
import { currency_format } from 'lib/format-money';
import { list_servers } from 'lib/list-servers';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  const servers = find_servers(ns).map(ns.getServer);
  servers.sort((l, r) => {
    if (l.requiredHackingSkill != r.requiredHackingSkill) {
      return (l.requiredHackingSkill ?? 0) - (r.requiredHackingSkill ?? 0);
    }
    return 0;
  })

  list_servers(ns, servers);
}
