import { NS } from '@ns'
import { SingularityAsync } from './dodge-interfaces/singu-interface';
import { worker_dispatch } from '/lib/worker_dispatch';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  ns.disableLog('getServerUsedRam');
  ns.disableLog('getServerMaxRam');
  ns.tprint(await worker_dispatch(ns, 'getCurrentServer'));
}

export function singularity_async(ns: NS): SingularityAsync {
  const singularity_async: SingularityAsync = {
    applyToCompany: async (companyName, field) => await worker_dispatch(ns, 'singularity.applyToCompany', companyName, field),
    b1tflum3: async (nextBN, callbackScript, bitNodeOptions) => await worker_dispatch(ns, 'singularity.b1tflume', nextBN, callbackScript, bitNodeOptions),
    checkFactionInvitations: async () => await worker_dispatch(ns, 'singularity.checkFactionInvitations'),
    commitCrime: async (crime, focus) => await worker_dispatch(ns, 'singularity.commitCrime', crime, focus),
    connect: async (hostname) => await worker_dispatch(ns, 'singularity.connect', hostname),
    createProgram: async (program, focus) => await worker_dispatch(ns, 'singularity.createProgram', program, focus),
    destroyW0r1dD43m0n: async (nextBN, callbackScript, bitNodeOptions) => await worker_dispatch(ns, 'singularity.destroyW0r1dD43m0n', nextBN, callbackScript, bitNodeOptions),
    donateToFaction: async (faction, amount) => await worker_dispatch(ns, 'singularity.donateToFaction', faction, amount),
    exportGame: async () => await worker_dispatch(ns, 'singularity.exportGame'),
    exportGameBonus: async () => await worker_dispatch(ns, 'singularity.exportGameBonus'),
    getAugmentationBasePrice: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationBasePrice', augName),
    getAugmentationFactions: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationFactions', augName),
    getAugmentationPrereq: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationPrereq', augName),
    getAugmentationPrice: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationPrice', augName),
    getAugmentationRepReq: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationRepReq', augName),
    getAugmentationsFromFaction: async (faction) => await worker_dispatch(ns, 'singularity.getAugmentationsFromFaction', faction),
    getAugmentationStats: async (name) => await worker_dispatch(ns, 'singularity.getAugmentationStats', name),
    getCompanyFavor: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyFavor', companyName),
    getCompanyFavorGain: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyFavorGain', companyName),
    getCompanyPositionInfo: async (companyName, positionName) => await worker_dispatch(ns, 'singularity.getCompanyPositionInfo', companyName, positionName),
    getCompanyPositions: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyPositions', companyName),
    getCompanyRep: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyRep', companyName),
    getCrimeChance: async (crime) => await worker_dispatch(ns, 'singularity.getCrimeChance', crime),
    getCrimeStats: async (crime) => await worker_dispatch(ns, 'singularity.getCrimeStats', crime),
    getCurrentServer: async () => await worker_dispatch(ns, 'singularity.getCurrentServer'),
    getCurrentWork: async () => await worker_dispatch(ns, 'singularity.getCurrentWork'),
    getDarkwebProgramCost: async (programName) => await worker_dispatch(ns, 'singularity.getDarkwebProgramCost', programName),
    getDarkwebPrograms: async () => await worker_dispatch(ns, 'singularity.getDarkwebPrograms'),
    getFactionEnemies: async (faction) => await worker_dispatch(ns, 'singularity.getFactionEnemies', faction),
    getFactionFavor: async (faction) => await worker_dispatch(ns, 'singularity.getFactionFavor', faction),
    getFactionFavorGain: async (faction) => await worker_dispatch(ns, 'singularity.getFactionFavorGain', faction),
    getFactionInviteRequirements: async (faction) => await worker_dispatch(ns, 'singularity.getFactionInviteRequirements', faction),
    getFactionRep: async (faction) => await worker_dispatch(ns, 'singularity.getFactionRep', faction),
    getFactionWorkTypes: async (faction) => await worker_dispatch(ns, 'singularity.getFactionWorkTypes', faction),
    getOwnedAugmentations: async (purchased) => await worker_dispatch(ns, 'singularity.getOwnedAugmentations', purchased),
    getOwnedSourceFiles: async () => await worker_dispatch(ns, 'singularity.getOwnedSourceFiles'),
    getUpgradeHomeCoresCost: async () => await worker_dispatch(ns, 'singularity.getUpgradeHomeCoresCost'),
    getUpgradeHomeRamCost: async () => await worker_dispatch(ns, 'singularity.getUpgradeHomeRamCost'),
    goToLocation: async (locationName) => await worker_dispatch(ns, 'singularity.goToLocation', locationName),
    gymWorkout: async (gymName, stat, focus) => await worker_dispatch(ns, 'singularity.gymWorkout', gymName, stat, focus),
    hospitalize: async () => await worker_dispatch(ns, 'singularity.hospitalize'),
    installAugmentations: async (cbScript) => await worker_dispatch(ns, 'singularity.installAugmentations', cbScript),
    installBackdoor: async () => await worker_dispatch(ns, 'singularity.installBackdoor'),
    isBusy: async () => await worker_dispatch(ns, 'singularity.isBusy'),
    isFocused: async () => await worker_dispatch(ns, 'singularity.isFocused'),
    joinFaction: async (faction) => await worker_dispatch(ns, 'singularity.joinFaction', faction),
    manualHack: async () => await worker_dispatch(ns, 'singularity.manualHack'),
    purchaseAugmentation: async (faction, augmentation) => await worker_dispatch(ns, 'singularity.purchaseAugmentation', faction, augmentation),
    purchaseProgram: async (programName) => await worker_dispatch(ns, 'singularity.purchaseProgram', programName),
    purchaseTor: async () => await worker_dispatch(ns, 'singularity.purchaseTor'),
    quitJob: async (companyName) => await worker_dispatch(ns, 'singularity.quitJob', companyName),
    setFocus: async (focus) => await worker_dispatch(ns, 'singularity.setFocus', focus),
    softReset: async (cbScript) => await worker_dispatch(ns, 'singularity.softReset', cbScript),
    stopAction: async () => await worker_dispatch(ns, 'singularity.stopAction'),
    travelToCity: async (city) => await worker_dispatch(ns, 'singularity.travelToCity', city),
    universityCourse: async (universityName, courseName, focus) => await worker_dispatch(ns, 'singularity.universityCourse', universityName, courseName, focus),
    upgradeHomeCores: async () => await worker_dispatch(ns, 'singularity.upgradeHomeCores'),
    upgradeHomeRam: async () => await worker_dispatch(ns, 'singularity.upgradeHomeRam'),
    workForCompany: async (companyName, focus) => await worker_dispatch(ns, 'singularity.workForCompany', companyName, focus),
    workForFaction: async (faction, workType, focus) => await worker_dispatch(ns, 'singularity.workForFaction', faction, workType, focus),
  };
  return singularity_async;
}

