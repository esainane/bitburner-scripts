import { NS } from '@ns'
import { ThreadAllocator } from './thread-allocator';
import { SingularityAsync } from './singu-interface';
import { mkfifo } from '/lib/mkfifo';

// Small helper for offloading extremely high ram cost functions to serially distinct scripts
// exec a helper script, read the result from a pipe, return the result

export async function worker_dispatch(ns: NS, name: string, ...args: any[]) {
  const fifo = mkfifo(ns);
  const options = {
    threads: 1,
    ramOverride: ns.getScriptRam('worker/singu.js', 'home')
               + ns.getFunctionRamCost(`singularity.${name}`) };
  do {
    const allocator = new ThreadAllocator(ns, new Set(), new Set()).getAllocator()
    const [unallocable, pids] = await allocator('worker/singu.js', options, false, fifo, name, ...args.map(d => JSON.stringify(d)));
    if (unallocable) {
      await ns.asleep(450);
    } else {
      //ns.tprint(`Dispatched worker successfully, ${unallocable} unallocable, ${JSON.stringify(pids)} pids`);
      break;
    }
  // eslint-disable-next-line no-constant-condition
  } while (true);
  const handle = ns.getPortHandle(fifo);
  if (handle.empty()) {
    await handle.nextWrite();
  }
  const data = await handle.read();
  if (data === undefined) {
    return data;
  }
  return JSON.parse(data, (key: string, value: any): any => {
    // Return undefined as undefined
    if (value === 'undefined') {
      return undefined;
    }
    return value;
  });
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  ns.disableLog('getServerUsedRam');
  ns.disableLog('getServerMaxRam');
  ns.tprint(await worker_dispatch(ns, 'getCurrentServer'));
}

export function singularity_async(ns: NS): SingularityAsync {
  const singularity_async: SingularityAsync = {
    applyToCompany: async (companyName, field) => await worker_dispatch(ns, 'applyToCompany', companyName, field),
    b1tflum3: async (nextBN, callbackScript, bitNodeOptions) => await worker_dispatch(ns, 'b1tflume', nextBN, callbackScript, bitNodeOptions),
    checkFactionInvitations: async () => await worker_dispatch(ns, 'checkFactionInvitations'),
    commitCrime: async (crime, focus) => await worker_dispatch(ns, 'commitCrime', crime, focus),
    connect: async (hostname) => await worker_dispatch(ns, 'connect', hostname),
    createProgram: async (program, focus) => await worker_dispatch(ns, 'createProgram', program, focus),
    destroyW0r1dD43m0n: async (nextBN, callbackScript, bitNodeOptions) => await worker_dispatch(ns, 'destroyW0r1dD43m0n', nextBN, callbackScript, bitNodeOptions),
    donateToFaction: async (faction, amount) => await worker_dispatch(ns, 'donateToFaction', faction, amount),
    exportGame: async () => await worker_dispatch(ns, 'exportGame'),
    exportGameBonus: async () => await worker_dispatch(ns, 'exportGameBonus'),
    getAugmentationBasePrice: async (augName) => await worker_dispatch(ns, 'getAugmentationBasePrice', augName),
    getAugmentationFactions: async (augName) => await worker_dispatch(ns, 'getAugmentationFactions', augName),
    getAugmentationPrereq: async (augName) => await worker_dispatch(ns, 'getAugmentationPrereq', augName),
    getAugmentationPrice: async (augName) => await worker_dispatch(ns, 'getAugmentationPrice', augName),
    getAugmentationRepReq: async (augName) => await worker_dispatch(ns, 'getAugmentationRepReq', augName),
    getAugmentationsFromFaction: async (faction) => await worker_dispatch(ns, 'getAugmentationsFromFaction', faction),
    getAugmentationStats: async (name) => await worker_dispatch(ns, 'getAugmentationStats', name),
    getCompanyFavor: async (companyName) => await worker_dispatch(ns, 'getCompanyFavor', companyName),
    getCompanyFavorGain: async (companyName) => await worker_dispatch(ns, 'getCompanyFavorGain', companyName),
    getCompanyPositionInfo: async (companyName, positionName) => await worker_dispatch(ns, 'getCompanyPositionInfo', companyName, positionName),
    getCompanyPositions: async (companyName) => await worker_dispatch(ns, 'getCompanyPositions', companyName),
    getCompanyRep: async (companyName) => await worker_dispatch(ns, 'getCompanyRep', companyName),
    getCrimeChance: async (crime) => await worker_dispatch(ns, 'getCrimeChance', crime),
    getCrimeStats: async (crime) => await worker_dispatch(ns, 'getCrimeStats', crime),
    getCurrentServer: async () => await worker_dispatch(ns, 'getCurrentServer'),
    getCurrentWork: async () => await worker_dispatch(ns, 'getCurrentWork'),
    getDarkwebProgramCost: async (programName) => await worker_dispatch(ns, 'getDarkwebProgramCost', programName),
    getDarkwebPrograms: async () => await worker_dispatch(ns, 'getDarkwebPrograms'),
    getFactionEnemies: async (faction) => await worker_dispatch(ns, 'getFactionEnemies', faction),
    getFactionFavor: async (faction) => await worker_dispatch(ns, 'getFactionFavor', faction),
    getFactionFavorGain: async (faction) => await worker_dispatch(ns, 'getFactionFavorGain', faction),
    getFactionInviteRequirements: async (faction) => await worker_dispatch(ns, 'getFactionInviteRequirements', faction),
    getFactionRep: async (faction) => await worker_dispatch(ns, 'getFactionRep', faction),
    getFactionWorkTypes: async (faction) => await worker_dispatch(ns, 'getFactionWorkTypes', faction),
    getOwnedAugmentations: async (purchased) => await worker_dispatch(ns, 'getOwnedAugmentations', purchased),
    getOwnedSourceFiles: async () => await worker_dispatch(ns, 'getOwnedSourceFiles'),
    getUpgradeHomeCoresCost: async () => await worker_dispatch(ns, 'getUpgradeHomeCoresCost'),
    getUpgradeHomeRamCost: async () => await worker_dispatch(ns, 'getUpgradeHomeRamCost'),
    goToLocation: async (locationName) => await worker_dispatch(ns, 'goToLocation', locationName),
    gymWorkout: async (gymName, stat, focus) => await worker_dispatch(ns, 'gymWorkout', gymName, stat, focus),
    hospitalize: async () => await worker_dispatch(ns, 'hospitalize'),
    installAugmentations: async (cbScript) => await worker_dispatch(ns, 'installAugmentations', cbScript),
    installBackdoor: async () => await worker_dispatch(ns, 'installBackdoor'),
    isBusy: async () => await worker_dispatch(ns, 'isBusy'),
    isFocused: async () => await worker_dispatch(ns, 'isFocused'),
    joinFaction: async (faction) => await worker_dispatch(ns, 'joinFaction', faction),
    manualHack: async () => await worker_dispatch(ns, 'manualHack'),
    purchaseAugmentation: async (faction, augmentation) => await worker_dispatch(ns, 'purchaseAugmentation', faction, augmentation),
    purchaseProgram: async (programName) => await worker_dispatch(ns, 'purchaseProgram', programName),
    purchaseTor: async () => await worker_dispatch(ns, 'purchaseTor'),
    quitJob: async (companyName) => await worker_dispatch(ns, 'quitJob', companyName),
    setFocus: async (focus) => await worker_dispatch(ns, 'setFocus', focus),
    softReset: async (cbScript) => await worker_dispatch(ns, 'softReset', cbScript),
    stopAction: async () => await worker_dispatch(ns, 'stopAction'),
    travelToCity: async (city) => await worker_dispatch(ns, 'travelToCity', city),
    universityCourse: async (universityName, courseName, focus) => await worker_dispatch(ns, 'universityCourse', universityName, courseName, focus),
    upgradeHomeCores: async () => await worker_dispatch(ns, 'upgradeHomeCores'),
    upgradeHomeRam: async () => await worker_dispatch(ns, 'upgradeHomeRam'),
    workForCompany: async (companyName, focus) => await worker_dispatch(ns, 'workForCompany', companyName, focus),
    workForFaction: async (faction, workType, focus) => await worker_dispatch(ns, 'workForFaction', faction, workType, focus),
  };
  return singularity_async;
}

