import { NS } from '@ns'
import { CodingContractAsync } from '../dodge-interfaces/cct';
import { worker_dispatch } from '../ram_dodge';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('scan');
  ns.disableLog('getServerUsedRam');
  ns.disableLog('getServerMaxRam');
  ns.tprint(await worker_dispatch(ns, 'getCurrentServer'));
}

/**
 * Create an object which mimics the CodingContract API, but is asynchronous.
 *
 * Names are prefixed with dodge_ to avoid false positives by the static ram analyzer.
 * Note that you must still have enough RAM to perform the call; this just means that you only need enough RAM to
 * perform one call at a time, rather than enough RAM to perform all calls which a script might use simultaneously.
 */
export function codingcontract_async(ns: NS): CodingContractAsync {
  const codingcontract_async: CodingContractAsync = {
    dodge_attempt: (answer, filename, host) => worker_dispatch(ns, 'codingcontract.attempt', answer, filename, host),
    dodge_createDummyContract: (type) => worker_dispatch(ns, 'codingcontract.createDummyContract', type),
    dodge_getContractType: (filename, host) => worker_dispatch(ns, 'codingcontract.getContractType', filename, host),
    dodge_getContractTypes: () => worker_dispatch(ns, 'codingcontract.getContractTypes'),
    dodge_getData: (filename, host) => worker_dispatch(ns, 'codingcontract.getData', filename, host),
    dodge_getDescription: (filename, host) => worker_dispatch(ns, 'codingcontract.getDescription', filename, host),
    dodge_getNumTriesRemaining: (filename, host) => worker_dispatch(ns, 'codingcontract.getNumTriesRemaining', filename, host),
  };
  return codingcontract_async;
}
