import { NS } from '@ns'
import { SingularityAsync } from '../dodge-interfaces/singu';
import { worker_dispatch } from '../ram_dodge';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  ns.disableLog('getServerUsedRam');
  ns.disableLog('getServerMaxRam');
  ns.tprint(await worker_dispatch(ns, 'getCurrentServer'));
}

/**
 * Create an object which mimics the Singularity API, but is asynchronous.
 *
 * Names are prefixed with dodge_ to avoid false positives by the static ram analyzer.
 * Note that you must still have the real singularity API unlocked (so the workers can use it) and enough RAM to
 * perform the call; this just means that you only need enough RAM to perform one call at a time, rather than enough
 * RAM to perform all calls which a script might use simultaneously.
 */
export function singularity_async(ns: NS): SingularityAsync {
  const singularity_async: SingularityAsync = {
    dodge_applyToCompany: async (companyName, field) => await worker_dispatch(ns, 'singularity.applyToCompany', companyName, field),
    dodge_b1tflum3: async (nextBN, callbackScript, bitNodeOptions) => await worker_dispatch(ns, 'singularity.b1tflume', nextBN, callbackScript, bitNodeOptions),
    dodge_checkFactionInvitations: async () => await worker_dispatch(ns, 'singularity.checkFactionInvitations'),
    dodge_commitCrime: async (crime, focus) => await worker_dispatch(ns, 'singularity.commitCrime', crime, focus),
    dodge_connect: async (hostname) => await worker_dispatch(ns, 'singularity.connect', hostname),
    dodge_createProgram: async (program, focus) => await worker_dispatch(ns, 'singularity.createProgram', program, focus),
    dodge_destroyW0r1dD43m0n: async (nextBN, callbackScript, bitNodeOptions) => await worker_dispatch(ns, 'singularity.destroyW0r1dD43m0n', nextBN, callbackScript, bitNodeOptions),
    dodge_donateToFaction: async (faction, amount) => await worker_dispatch(ns, 'singularity.donateToFaction', faction, amount),
    dodge_exportGame: async () => await worker_dispatch(ns, 'singularity.exportGame'),
    dodge_exportGameBonus: async () => await worker_dispatch(ns, 'singularity.exportGameBonus'),
    dodge_getAugmentationBasePrice: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationBasePrice', augName),
    dodge_getAugmentationFactions: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationFactions', augName),
    dodge_getAugmentationPrereq: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationPrereq', augName),
    dodge_getAugmentationPrice: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationPrice', augName),
    dodge_getAugmentationRepReq: async (augName) => await worker_dispatch(ns, 'singularity.getAugmentationRepReq', augName),
    dodge_getAugmentationsFromFaction: async (faction) => await worker_dispatch(ns, 'singularity.getAugmentationsFromFaction', faction),
    dodge_getAugmentationStats: async (name) => await worker_dispatch(ns, 'singularity.getAugmentationStats', name),
    dodge_getCompanyFavor: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyFavor', companyName),
    dodge_getCompanyFavorGain: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyFavorGain', companyName),
    dodge_getCompanyPositionInfo: async (companyName, positionName) => await worker_dispatch(ns, 'singularity.getCompanyPositionInfo', companyName, positionName),
    dodge_getCompanyPositions: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyPositions', companyName),
    dodge_getCompanyRep: async (companyName) => await worker_dispatch(ns, 'singularity.getCompanyRep', companyName),
    dodge_getCrimeChance: async (crime) => await worker_dispatch(ns, 'singularity.getCrimeChance', crime),
    dodge_getCrimeStats: async (crime) => await worker_dispatch(ns, 'singularity.getCrimeStats', crime),
    dodge_getCurrentServer: async () => await worker_dispatch(ns, 'singularity.getCurrentServer'),
    dodge_getCurrentWork: async () => await worker_dispatch(ns, 'singularity.getCurrentWork'),
    dodge_getDarkwebProgramCost: async (programName) => await worker_dispatch(ns, 'singularity.getDarkwebProgramCost', programName),
    dodge_getDarkwebPrograms: async () => await worker_dispatch(ns, 'singularity.getDarkwebPrograms'),
    dodge_getFactionEnemies: async (faction) => await worker_dispatch(ns, 'singularity.getFactionEnemies', faction),
    dodge_getFactionFavor: async (faction) => await worker_dispatch(ns, 'singularity.getFactionFavor', faction),
    dodge_getFactionFavorGain: async (faction) => await worker_dispatch(ns, 'singularity.getFactionFavorGain', faction),
    dodge_getFactionInviteRequirements: async (faction) => await worker_dispatch(ns, 'singularity.getFactionInviteRequirements', faction),
    dodge_getFactionRep: async (faction) => await worker_dispatch(ns, 'singularity.getFactionRep', faction),
    dodge_getFactionWorkTypes: async (faction) => await worker_dispatch(ns, 'singularity.getFactionWorkTypes', faction),
    dodge_getOwnedAugmentations: async (purchased) => await worker_dispatch(ns, 'singularity.getOwnedAugmentations', purchased),
    dodge_getOwnedSourceFiles: async () => await worker_dispatch(ns, 'singularity.getOwnedSourceFiles'),
    dodge_getUpgradeHomeCoresCost: async () => await worker_dispatch(ns, 'singularity.getUpgradeHomeCoresCost'),
    dodge_getUpgradeHomeRamCost: async () => await worker_dispatch(ns, 'singularity.getUpgradeHomeRamCost'),
    dodge_goToLocation: async (locationName) => await worker_dispatch(ns, 'singularity.goToLocation', locationName),
    dodge_gymWorkout: async (gymName, stat, focus) => await worker_dispatch(ns, 'singularity.gymWorkout', gymName, stat, focus),
    dodge_hospitalize: async () => await worker_dispatch(ns, 'singularity.hospitalize'),
    dodge_installAugmentations: async (cbScript) => await worker_dispatch(ns, 'singularity.installAugmentations', cbScript),
    dodge_installBackdoor: async () => await worker_dispatch(ns, 'singularity.installBackdoor'),
    dodge_isBusy: async () => await worker_dispatch(ns, 'singularity.isBusy'),
    dodge_isFocused: async () => await worker_dispatch(ns, 'singularity.isFocused'),
    dodge_joinFaction: async (faction) => await worker_dispatch(ns, 'singularity.joinFaction', faction),
    dodge_manualHack: async () => await worker_dispatch(ns, 'singularity.manualHack'),
    dodge_purchaseAugmentation: async (faction, augmentation) => await worker_dispatch(ns, 'singularity.purchaseAugmentation', faction, augmentation),
    dodge_purchaseProgram: async (programName) => await worker_dispatch(ns, 'singularity.purchaseProgram', programName),
    dodge_purchaseTor: async () => await worker_dispatch(ns, 'singularity.purchaseTor'),
    dodge_quitJob: async (companyName) => await worker_dispatch(ns, 'singularity.quitJob', companyName),
    dodge_setFocus: async (focus) => await worker_dispatch(ns, 'singularity.setFocus', focus),
    dodge_softReset: async (cbScript) => await worker_dispatch(ns, 'singularity.softReset', cbScript),
    dodge_stopAction: async () => await worker_dispatch(ns, 'singularity.stopAction'),
    dodge_travelToCity: async (city) => await worker_dispatch(ns, 'singularity.travelToCity', city),
    dodge_universityCourse: async (universityName, courseName, focus) => await worker_dispatch(ns, 'singularity.universityCourse', universityName, courseName, focus),
    dodge_upgradeHomeCores: async () => await worker_dispatch(ns, 'singularity.upgradeHomeCores'),
    dodge_upgradeHomeRam: async () => await worker_dispatch(ns, 'singularity.upgradeHomeRam'),
    dodge_workForCompany: async (companyName, focus) => await worker_dispatch(ns, 'singularity.workForCompany', companyName, focus),
    dodge_workForFaction: async (faction, workType, focus) => await worker_dispatch(ns, 'singularity.workForFaction', faction, workType, focus),
  };
  return singularity_async;
}

