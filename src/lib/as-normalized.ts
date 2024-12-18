import { NS, Server } from '@ns';

export function as_normalized(ns: NS, server: string): Server {
  const min_security = ns.getServerMinSecurityLevel(server);
  const max_money = ns.getServerMaxMoney(server);
  const ports_required = ns.getServerNumPortsRequired(server);
  return {
    hostname: server,
    ip: '',
    sshPortOpen: true,
    ftpPortOpen: true,
    smtpPortOpen: true,
    httpPortOpen: true,
    sqlPortOpen: true,
    hasAdminRights: true,
    cpuCores: 1,
    isConnectedTo: false,
    ramUsed: ns.getServerUsedRam(server),
    maxRam: ns.getServerMaxRam(server),
    organizationName: '',
    purchasedByPlayer: false,
    hackDifficulty: min_security,
    minDifficulty: min_security,
    moneyAvailable: max_money,
    moneyMax: max_money,
    numOpenPortsRequired: ports_required,
    openPortCount: ports_required,
    requiredHackingSkill: ns.getServerRequiredHackingLevel(server),
    serverGrowth: ns.getServerGrowth(server),
  };
}
