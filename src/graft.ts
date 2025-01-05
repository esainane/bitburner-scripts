import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  const to_graft = [
    'Hacknet Node CPU Architecture Neural-Upload',
    'Hacknet Node Kernel Direct-Neural Interface',
    'Hacknet Node Core Direct-Neural Interface',
    'Neurotrainer I',
    'Synaptic Enhancement Implant',
    'BitWire',
    'Neurotrainer II',
    'Cranial Signal Processors - Gen I',
    'Artificial Synaptic Potentiation',
    'Cranial Signal Processors - Gen II',
    'Power Recirculation Core',
    'Neurotrainer III',
    'CRTX42-AA Gene Modification',
    'The Black Hand',
    'Neural-Retention Enhancement',
    'Neuregen Gene Modification',
    'DataJack',
    'Cranial Signal Processors - Gen III',
    'Cranial Signal Processors - Gen IV',
    'Enhanced Myelin Sheathing',
    'Neuronal Densification',
    'Neural Accelerator',
    'nextSENS Gene Modification',
    'Cranial Signal Processors - Gen V',
    'Embedded Netburner Module',
    'Embedded Netburner Module Core Implant',
    'OmniTek InfoLoad',
    'Artificial Bio-neural Network Implant',
    'Neuralstimulator',
    'PC Direct-Neural Interface',
    'Xanipher',
    'BitRunners Neurolink',
    'Embedded Netburner Module Core V2 Upgrade',
    'PC Direct-Neural Interface Optimization Submodule',
    'SPTN-97 Gene Modification',
    'Unstable Circadian Modulator',
    'ECorp HVMind Implant',
    'Embedded Netburner Module Analyze Engine',
    'Embedded Netburner Module Direct Memory Access Upgrade',
    'Embedded Netburner Module Core V3 Upgrade',
    'PC Direct-Neural Interface NeuroNet Injector',
    'violet Congruity Implant',
    'QLink',
  ];
  for (const graft of to_graft) {
    ns.tprint(`Grafting ${graft}`);
    await ns.grafting.waitForOngoingGrafting();
    while (!ns.grafting.graftAugmentation(graft)) {
      if (ns.grafting.getGraftableAugmentations().includes(graft)) {
        // This is graftable, we just can't do it yet (not enough money?)
        await ns.asleep(5000);
      } else {
        // Already installed, or something else went wrong; on to the next
        break;
      }
    }
  }
}
