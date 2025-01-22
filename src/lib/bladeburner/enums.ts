// Workaround for enums in NetScriptDefinitions.d.ts not being declared const enums
// Delete this file completely and reference the real ones if fixed

/**
 * Action types of Bladeburner
 *
 * @public
 */
export enum BladeburnerActionType {
  General = "General",
  Contract = "Contracts",
  Operation = "Operations",
  BlackOp = "Black Operations",
}

/**
 * General action names of Bladeburner
 *
 * @public
 */
export enum BladeburnerGeneralActionName {
  Training = "Training",
  FieldAnalysis = "Field Analysis",
  Recruitment = "Recruitment",
  Diplomacy = "Diplomacy",
  HyperbolicRegen = "Hyperbolic Regeneration Chamber",
  InciteViolence = "Incite Violence",
}

/**
 * Contract names of Bladeburner
 *
 * @public
 */
export enum BladeburnerContractName {
  Tracking = "Tracking",
  BountyHunter = "Bounty Hunter",
  Retirement = "Retirement",
}

/**
 * Operation names of Bladeburner
 *
 * @public
 */
export enum BladeburnerOperationName {
  Investigation = "Investigation",
  Undercover = "Undercover Operation",
  Sting = "Sting Operation",
  Raid = "Raid",
  StealthRetirement = "Stealth Retirement Operation",
  Assassination = "Assassination",
}

/**
 * Black Operation names of Bladeburner
 *
 * @public
 */
export enum BladeburnerBlackOpName {
  OperationTyphoon = "Operation Typhoon",
  OperationZero = "Operation Zero",
  OperationX = "Operation X",
  OperationTitan = "Operation Titan",
  OperationAres = "Operation Ares",
  OperationArchangel = "Operation Archangel",
  OperationJuggernaut = "Operation Juggernaut",
  OperationRedDragon = "Operation Red Dragon",
  OperationK = "Operation K",
  OperationDeckard = "Operation Deckard",
  OperationTyrell = "Operation Tyrell",
  OperationWallace = "Operation Wallace",
  OperationShoulderOfOrion = "Operation Shoulder of Orion",
  OperationHyron = "Operation Hyron",
  OperationMorpheus = "Operation Morpheus",
  OperationIonStorm = "Operation Ion Storm",
  OperationAnnihilus = "Operation Annihilus",
  OperationUltron = "Operation Ultron",
  OperationCenturion = "Operation Centurion",
  OperationVindictus = "Operation Vindictus",
  OperationDaedalus = "Operation Daedalus",
}

/**
 * Skill names type of Bladeburner
 *
 * @public
 */
export enum BladeburnerSkillName {
  BladesIntuition = "Blade's Intuition",
  Cloak = "Cloak",
  ShortCircuit = "Short-Circuit",
  DigitalObserver = "Digital Observer",
  Tracer = "Tracer",
  Overclock = "Overclock",
  Reaper = "Reaper",
  EvasiveSystem = "Evasive System",
  Datamancer = "Datamancer",
  CybersEdge = "Cyber's Edge",
  HandsOfMidas = "Hands of Midas",
  Hyperdrive = "Hyperdrive",
}

/**
 * @public
 */
export type BladeburnerActionName =
  | BladeburnerGeneralActionName
  | BladeburnerContractName
  | BladeburnerOperationName
  | BladeburnerBlackOpName;

/**
 * These special Bladeburner action types are only for Sleeve
 *
 * @public
 */
export enum SpecialBladeburnerActionTypeForSleeve {
  InfiltrateSynthoids = "Infiltrate Synthoids",
  SupportMainSleeve = "Support main sleeve",
  TakeOnContracts = "Take on contracts",
}

/**
 * @public
 */
export type BladeburnerActionTypeForSleeve =
  | Exclude<BladeburnerGeneralActionName, BladeburnerGeneralActionName.InciteViolence>
  | SpecialBladeburnerActionTypeForSleeve;
