import { BitNodeOptions, CityName, CompanyName, CompanyPositionInfo, CrimeStats, CrimeType, FactionWorkType, GymLocationName, GymType, JobField, JobName, LocationName, Multipliers, PlayerRequirement, SourceFileLvl, Task, UniversityClassType, UniversityLocationName } from "@ns";

/**
 * Singularity API, but all functions are async
 *
 *
 * To update:
    sed -ie '/^ \*\//q' src/lib/singu-interface.ts
    sed -ne '/^export interface Singularity {$/,/^}$/{s/Singularity/SingularityAsync/;s/^\(  [^*]*.*): \)\([^()]\+\);$/\1Promise<\2>;/;p}' NetScriptDefinitions.d.ts >> src/lib/singu-interface.ts
 */
export interface SingularityAsync {
  /**
   * Backup game save.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   *
   * This function will automatically open the backup save prompt and claim the free faction favour if available.
   *
   */
  exportGame(): Promise<void>;

  /**
   * Returns Backup save bonus availability.
   * @remarks
   * RAM cost: 0.5 GB * 16/4/1
   *
   *
   * This function will check if there is a bonus for backing up your save.
   *
   */
  exportGameBonus(): Promise<boolean>;

  /**
   * Take university class.
   *
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * This function will automatically set you to start taking a course at a university.
   * If you are already in the middle of some “working” action (such as working at a
   * company, for a faction, or on a program), then running this function will automatically
   * cancel that action and give you your earnings.
   *
   * The cost and experience gains for all of these universities and classes are the same as
   * if you were to manually visit and take these classes.
   *
   * @param universityName - Name of university. You must be in the correct city for whatever university you specify.
   * @param courseName - Name of course.
   * @param focus - Acquire player focus on this class. Optional. Defaults to true.
   * @returns True if action is successfully started, false otherwise.
   */
  universityCourse(
    universityName: UniversityLocationName | `${UniversityLocationName}`,
    courseName: UniversityClassType | `${UniversityClassType}`,
    focus?: boolean,
  ): Promise<boolean>;

  /**
   * Workout at the gym.
   *
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *

   * This function will automatically set you to start working out at a gym to train
   * a particular stat. If you are already in the middle of some “working” action
   * (such as working at a company, for a faction, or on a program), then running
   * this function will automatically cancel that action and give you your earnings.
   *
   * The cost and experience gains for all of these gyms are the same as if you were
   * to manually visit these gyms and train
   *
   * @param gymName - Name of gym. You must be in the correct city for whatever gym you specify.
   * @param stat - The stat you want to train.
   * @param focus - Acquire player focus on this gym workout. Optional. Defaults to true.
   * @returns True if action is successfully started, false otherwise.
   */
  gymWorkout(gymName: GymLocationName | `${GymLocationName}`, stat: GymType | `${GymType}`, focus?: boolean): Promise<boolean>;

  /**
   * Travel to another city.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * This function allows the player to travel to any city. The cost for using this
   * function is the same as the cost for traveling through the Travel Agency.
   *
   * @param city - City to travel to.
   * @returns True if action is successful, false otherwise.
   */
  travelToCity(city: CityName | `${CityName}`): Promise<boolean>;

  /**
   * Purchase the TOR router.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * This function allows you to automatically purchase a TOR router. The cost for
   * purchasing a TOR router using this function is the same as if you were to
   * manually purchase one.
   *
   * @returns True if action is successful or if you already own TOR router, false otherwise.
   */
  purchaseTor(): Promise<boolean>;

  /**
   * Purchase a program from the dark web.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * This function allows you to automatically purchase programs. You MUST have a
   * TOR router in order to use this function. The cost of purchasing programs
   * using this function is the same as if you were purchasing them through the Dark
   * Web using the Terminal buy command.
   *
   * @example
   * ```js
   * const programName = "BruteSSH.exe";
   * const success = ns.singularity.purchaseProgram(programName);
   * if (!success) ns.tprint(`ERROR: Failed to purchase ${programName}`);
   * ```
   * @param programName - Name of program to purchase.
   * @returns True if the specified program is purchased, and false otherwise.
   */
  purchaseProgram(programName: string): Promise<boolean>;

  /**
   * Check if the player is busy.
   * @remarks
   * RAM cost: 0.5 GB * 16/4/1
   *
   *
   * Returns a boolean indicating whether or not the player is currently performing an
   * ‘action’. These actions include working for a company/faction, studying at a university,
   * working out at a gym, creating a program, committing a crime, etc.
   *
   * @returns True if the player is currently performing an ‘action’, false otherwise.
   */
  isBusy(): Promise<boolean>;

  /**
   * Stop the current action.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   *
   * This function is used to end whatever ‘action’ the player is currently performing.
   * The player will receive whatever money/experience/etc. he has earned from that action.
   *
   * The actions that can be stopped with this function are:
   *
   * * Studying at a university
   * * Working out at a gym
   * * Working for a company/faction
   * * Creating a program
   * * Committing a crime
   *
   * This function will return true if the player’s action was ended.
   * It will return false if the player was not performing an action when this function was called.
   *
   * @returns True if the player’s action was ended, false if the player was not performing an action.
   */
  stopAction(): Promise<boolean>;

  /**
   * Upgrade home computer RAM.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * This function will upgrade amount of RAM on the player’s home computer. The cost is
   * the same as if you were to do it manually.
   *
   * This function will return true if the player’s home computer RAM is successfully upgraded, and false otherwise.
   *
   * @returns True if the player’s home computer RAM is successfully upgraded, and false otherwise.
   */
  upgradeHomeRam(): Promise<boolean>;

  /**
   * Upgrade home computer cores.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * This function will upgrade amount of cores on the player’s home computer. The cost is
   * the same as if you were to do it manually.
   *
   * This function will return true if the player’s home computer cores is successfully upgraded, and false otherwise.
   *
   * @returns True if the player’s home computer cores is successfully upgraded, and false otherwise.
   */
  upgradeHomeCores(): Promise<boolean>;

  /**
   * Get the price of upgrading home RAM.
   * @remarks
   * RAM cost: 1.5 GB * 16/4/1
   *
   *
   * Returns the cost of upgrading the player’s home computer RAM.
   *
   * @returns Cost of upgrading the player’s home computer RAM.
   */
  getUpgradeHomeRamCost(): Promise<number>;

  /**
   * Get the price of upgrading home cores.
   * @remarks
   * RAM cost: 1.5 GB * 16/4/1
   *
   *
   * Returns the cost of upgrading the player’s home computer cores.
   *
   * @returns Cost of upgrading the player’s home computer cores.
   */
  getUpgradeHomeCoresCost(): Promise<number>;

  /**
   * Get Requirements for Company Position.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * This function will return an object that contains the requirements for
   * a specific position at a specific country.
   *
   * @example
   * ```js
   * const companyName = "ECorp";
   * const position = "Chief Executive Officer";
   *
   * let requirements = ns.singularity.getCompanyPositionInfo(companyName, position);
   * ```
   * @param companyName - Name of company to get the requirements for. Must be an exact match.
   * @param positionName - Name of position to get the requirements for. Must be an exact match.
   * @returns CompanyPositionInfo object.
   */
  getCompanyPositionInfo(
    companyName: CompanyName | `${CompanyName}`,
    positionName: JobName | `${JobName}`,
  ): Promise<CompanyPositionInfo>;

  /**
   * Get List of Company Positions.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * This function will return a list of positions at a specific company.
   *
   * This function will return the position list if the company name is valid.
   *
   * @example
   * ```js
   * const companyName = "Noodle Bar";
   * const jobList = ns.singularity.getCompanyPositions(companyName);
   * ```
   * @param companyName - Name of company to get the position list for. Must be an exact match.
   * @returns The position list if the company name is valid.
   */
  getCompanyPositions(companyName: CompanyName | `${CompanyName}`): Promise<JobName[]>;

  /**
   * Work for a company.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * This function will set you to start working at your current job at a specified company at which you are employed.
   * If you are already in the middle of some “working” action (such as working for a faction, training at a gym, or
   * creating a program), then running this function will cancel that action.
   *
   * This function will return true if the player starts working, and false otherwise.
   *
   * @example
   * ```js
   * const companyName = "Noodle Bar";
   * const success = ns.singularity.workForCompany(companyName);
   * if (!success) ns.tprint(`ERROR: Failed to start work at ${companyName}.`);
   * ```
   * @param companyName - Name of company to work for. Must be an exact match. Optional. If not specified, this
   *   argument defaults to the last job that you worked.
   * @param focus - Acquire player focus on this work operation. Optional. Defaults to true.
   * @returns True if the player starts working, and false otherwise.
   */
  workForCompany(companyName: CompanyName, focus?: boolean): Promise<boolean>;

  /**
   * Quit jobs by company.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * This function will finish work with the company provided and quit any jobs.
   *
   * @param companyName - Name of the company.
   */
  quitJob(companyName?: CompanyName | `${CompanyName}`): Promise<void>;

  /**
   * Apply for a job at a company.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * This function will automatically try to apply to the specified company
   * for a position in the specified field. This function can also be used to
   * apply for promotions by specifying the company and field you are already
   * employed at.
   *
   * This function will return the job name if you successfully get a job/promotion,
   * and null otherwise. Note that if you are trying to use this function to
   * apply for a promotion and don’t get one, the function will return null.
   *
   * @param companyName - Name of company to apply to.
   * @param field - Field to which you want to apply.
   * @returns Job name if the player successfully get a job/promotion, and null otherwise.
   */
  applyToCompany(companyName: CompanyName | `${CompanyName}`, field: JobField | `${JobField}`): Promise<JobName | null>;

  /**
   * Get company reputation.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   *
   * This function will return the amount of reputation you have at the specified company.
   * If the company passed in as an argument is invalid, -1 will be returned.
   *
   * @param companyName - Name of the company.
   * @returns Amount of reputation you have at the specified company.
   */
  getCompanyRep(companyName: CompanyName | `${CompanyName}`): Promise<number>;

  /**
   * Get company favor.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   *
   * This function will return the amount of favor you have at the specified company.
   * If the company passed in as an argument is invalid, -1 will be returned.
   *
   * @param companyName - Name of the company.
   * @returns Amount of favor you have at the specified company.
   */
  getCompanyFavor(companyName: CompanyName | `${CompanyName}`): Promise<number>;

  /**
   * Get company favor gain.
   * @remarks
   * RAM cost: 0.75 GB * 16/4/1
   *
   *
   * This function will return the amount of favor you will gain for the specified
   * company when you reset by installing Augmentations.
   *
   * @param companyName - Name of the company.
   * @returns Amount of favor you gain at the specified company when you reset by installing Augmentations.
   */
  getCompanyFavorGain(companyName: CompanyName | `${CompanyName}`): Promise<number>;

  /**
   * List conditions for being invited to a faction.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   * @param faction - Name of the faction
   * @returns Array of PlayerRequirement objects which must all be fulfilled to receive an invitation.
   *
   * @example
   * ```js
   * ns.singularity.getFactionInviteRequirements("The Syndicate");
   *
   * [
   *   { "type": "someCondition", "conditions": [
   *       { "type": "city", "city": "Aevum" },
   *       { "type": "city", "city": "Sector-12" }
   *     ]
   *   },
   *   { "type": "not", "condition": {
   *       "type": "employedBy", "company": "Central Intelligence Agency"
   *     }
   *   },
   *   { "type": "not", "condition": {
   *       "type": "employedBy", "company": "National Security Agency"
   *     }
   *   },
   *   { "type": "money", "money": 10000000 },
   *   { "type": "skills", "skills": { "hacking": 200 } },
   *   { "type": "skills", "skills": { "strength": 200 } },
   *   { "type": "skills", "skills": { "defense": 200 } },
   *   { "type": "skills", "skills": { "dexterity": 200 } },
   *   { "type": "skills", "skills": { "agility": 200 } },
   *   { "type": "karma", "karma": -90 }
   * ]
   * ```
   */
  getFactionInviteRequirements(faction: string): Promise<PlayerRequirement[]>;

  /**
   * Get a list of enemies of a faction.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * Returns an array containing the names (as strings) of all factions
   * that are enemies of the specified faction.
   *
   * @param faction - Name of faction.
   * @returns Array containing the names of all enemies of the faction.
   */
  getFactionEnemies(faction: string): Promise<string[]>;

  /**
   * List all current faction invitations.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * Performs an immediate check for which factions you qualify for invites from, then returns an array with the name
   * of all Factions you have outstanding invitations from.
   *
   * @returns Array with the name of all Factions you currently have outstanding invitations from.
   */
  checkFactionInvitations(): Promise<string[]>;

  /**
   * Join a faction.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * This function will automatically accept an invitation from a faction and join it.
   *
   * @param faction - Name of faction to join.
   * @returns True if player joined the faction, and false otherwise.
   */
  joinFaction(faction: string): Promise<boolean>;

  /**
   * Work for a faction.
   * @remarks
   * RAM cost: 3 GB * 16/4/1
   *
   *
   * This function will set you to start working for the specified faction. You must be a member of the faction and
   * that faction must have the specified work type, or else this function will fail. If you are already in the
   * middle of some “working” action (such as working for a company, training at a gym, or creating a program), then
   * running this function will cancel that action.
   *
   * This function will return true if you successfully start working for the specified faction, and false otherwise.
   *
   * @example
   * ```js
   * const factionName = "CyberSec";
   * const workType = "hacking";
   *
   * let success = ns.singularity.workForFaction(factionName, workType);
   * if (!success) ns.tprint(`ERROR: Failed to start work for ${factionName} with work type ${workType}.`);
   * ```
   * @param faction - Name of faction to work for.
   * @param workType - Type of work to perform for the faction.
   * @param focus - Acquire player focus on this work operation. Optional. Defaults to true.
   * @returns True if the player starts working, and false otherwise.
   */
  workForFaction(faction: string, workType: FactionWorkType | `${FactionWorkType}`, focus?: boolean): Promise<boolean>;

  /**
   * Get the work types of a faction.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   * This function returns an array containing the work types of the specified faction.
   *
   * @param faction - Name of the faction.
   * @returns The work types of the faction.
   */
  getFactionWorkTypes(faction: string): Promise<FactionWorkType[]>;

  /**
   * Get faction reputation.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   *
   * This function returns the amount of reputation you have for the specified faction.
   *
   * @param faction - Name of faction to work for.
   * @returns Amount of reputation you have for the specified faction.
   */
  getFactionRep(faction: string): Promise<number>;

  /**
   * Get faction favor.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   *
   * This function returns the amount of favor you have for the specified faction.
   *
   * @param faction - Name of faction.
   * @returns Amount of favor you have for the specified faction.
   */
  getFactionFavor(faction: string): Promise<number>;

  /**
   * Get faction favor gain.
   * @remarks
   * RAM cost: 0.75 GB * 16/4/1
   *
   *
   * This function returns the amount of favor you will gain for the specified
   * faction when you reset by installing Augmentations.
   *
   * @param faction - Name of faction.
   * @returns Amount of favor you will gain for the specified faction when you reset by installing Augmentations.
   */
  getFactionFavorGain(faction: string): Promise<number>;

  /**
   * Donate to a faction.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * Attempts to donate money to the specified faction in exchange for reputation.
   * Returns true if you successfully donate the money, and false otherwise.
   *
   * You cannot donate to your gang's faction.
   *
   * The specified faction must offer at least 1 type of work. You can use {@link SingularityAsync.getFactionWorkTypes | getFactionWorkTypes} to get the list of work types of a faction.
   *
   * @param faction - Name of faction to donate to.
   * @param amount - Amount of money to donate.
   * @returns True if the money was donated, and false otherwise.
   */
  donateToFaction(faction: string, amount: number): Promise<boolean>;

  /**
   * Create a program.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function will automatically set you to start working on creating the
   * specified program. If you are already in the middle of some “working” action
   * (such as working for a company, training at a gym, or taking a course), then
   * running this function will automatically cancel that action and give you your
   * earnings.
   *
   * This function returns true if you successfully start working on the specified program, and false otherwise.
   *
   * Note that creating a program using this function has the same hacking level requirements as it normally would.
   * These level requirements are:<br/>
   * - BruteSSH.exe: 50<br/>
   * - FTPCrack.exe: 100<br/>
   * - relaySMTP.exe: 250<br/>
   * - HTTPWorm.exe: 500<br/>
   * - SQLInject.exe: 750<br/>
   * - DeepscanV1.exe: 75<br/>
   * - DeepscanV2.exe: 400<br/>
   * - ServerProfiler.exe: 75<br/>
   * - AutoLink.exe: 25
   *
   * @example
   * ```js
   * const programName = "BruteSSH.exe";
   * const success = ns.singularity.createProgram(programName);
   * if (!success) ns.tprint(`ERROR: Failed to start working on ${programName}`);
   * ```
   * @param program - Name of program to create.
   * @param focus - Acquire player focus on this program creation. Optional. Defaults to true.
   * @returns True if you successfully start working on the specified program, and false otherwise.
   */
  createProgram(program: string, focus?: boolean): Promise<boolean>;

  /**
   * Commit a crime.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function is used to automatically attempt to commit crimes.
   * If you are already in the middle of some ‘working’ action (such
   * as working for a company or training at a gym), then running this
   * function will automatically cancel that action and give you your
   * earnings.
   *
   * This function returns the number of milliseconds it takes to attempt the
   * specified crime (e.g. It takes 60 seconds to attempt the ‘Rob Store’ crime,
   * so running `commitCrime('Rob Store')` will return 60,000).
   *
   * @param crime - Name of crime to attempt.
   * @param focus - Acquire player focus on this crime. Optional. Defaults to true.
   * @returns The number of milliseconds it takes to attempt the specified crime.
   */
  commitCrime(crime: CrimeType | `${CrimeType}`, focus?: boolean): Promise<number>;

  /**
   * Get chance to successfully commit a crime.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function returns your chance of success at committing the specified crime.
   *
   * @param crime - Name of crime.
   * @returns Chance of success at committing the specified crime.
   */
  getCrimeChance(crime: CrimeType | `${CrimeType}`): Promise<number>;

  /**
   * Get stats related to a crime.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * Returns the stats of the crime.
   *
   * @param crime - Name of crime.
   * @returns The stats of the crime.
   */
  getCrimeStats(crime: CrimeType | `${CrimeType}`): Promise<CrimeStats>;

  /**
   * Get a list of owned augmentation.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function returns an array containing the names (as strings) of all Augmentations you have.
   *
   * @param purchased - Specifies whether the returned array should include Augmentations you have purchased but not
   *   yet installed. By default, this argument is false which means that the return value will NOT have the purchased
   *   Augmentations.
   * @returns Array containing the names (as strings) of all Augmentations you have.
   */
  getOwnedAugmentations(purchased?: boolean): Promise<string[]>;

  /**
   * Get a list of acquired Source-Files.
   * @remarks
   * RAM cost: 5 GB
   *
   *
   * Returns an array of source files. This function takes BitNode options into account.
   *
   * For example, let's say you have SF 1.3, but you overrode the active level of SF1 and set it to level 1. In this
   * case, this function returns {"n":1,"lvl":1}.
   *
   * If the active level of a source file is 0, that source file won't be included in the result.
   *
   * @returns Array containing an object with number and level of the source file.
   */
  getOwnedSourceFiles(): Promise<SourceFileLvl[]>;

  /**
   * Get a list of faction(s) that have a specific Augmentation.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * Returns an array containing the names (as strings) of all factions
   * that offer the specified Augmentation.
   * If no factions offer the Augmentation, a blank array is returned.
   *
   * @param augName - Name of Augmentation.
   * @returns Array containing the names of all factions.
   */
  getAugmentationFactions(augName: string): Promise<string[]>;

  /**
   * Get a list of augmentation available from a faction.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * Returns an array containing the names (as strings) of all Augmentations
   * that are available from the specified faction.
   *
   * @param faction - Name of faction.
   * @returns Array containing the names of all Augmentations.
   */
  getAugmentationsFromFaction(faction: string): Promise<string[]>;

  /**
   * Get the pre-requisite of an augmentation.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function returns an array with the names of the prerequisite Augmentation(s) for the specified Augmentation.
   * If there are no prerequisites, a blank array is returned.
   *
   * @param augName - Name of Augmentation.
   * @returns Array with the names of the prerequisite Augmentation(s) for the specified Augmentation.
   */
  getAugmentationPrereq(augName: string): Promise<string[]>;

  /**
   * Get price of an augmentation.
   * @remarks
   * RAM cost: 2.5 GB * 16/4/1
   *
   *
   * @param augName - Name of Augmentation.
   * @returns Price of the augmentation.
   */
  getAugmentationPrice(augName: string): Promise<number>;

  /**
   * Get base price of an augmentation.
   * @remarks
   * RAM cost: 2.5 GB * 16/4/1
   *
   *
   * @param augName - Name of Augmentation.
   * @returns Base price of the augmentation, before price multiplier.
   */
  getAugmentationBasePrice(augName: string): Promise<number>;

  /**
   * Get reputation requirement of an augmentation.
   * @remarks
   * RAM cost: 2.5 GB * 16/4/1
   *
   *
   * @param augName - Name of Augmentation.
   * @returns Reputation requirement of the augmentation.
   */
  getAugmentationRepReq(augName: string): Promise<number>;

  /**
   * Purchase an augmentation
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function will try to purchase the specified Augmentation through the given Faction.
   *
   * This function will return true if the Augmentation is successfully purchased, and false otherwise.
   *
   * @param faction - Name of faction to purchase Augmentation from.
   * @param augmentation - Name of Augmentation to purchase.
   * @returns True if the Augmentation is successfully purchased, and false otherwise.
   */
  purchaseAugmentation(faction: string, augmentation: string): Promise<boolean>;

  /**
   * Get the stats of an augmentation.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function returns augmentation stats.
   *
   * @param name - Name of Augmentation. CASE-SENSITIVE.
   * @returns Augmentation stats.
   */
  getAugmentationStats(name: string): Promise<Multipliers>;

  /**
   * Install your purchased augmentations.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function will automatically install your Augmentations, resetting the game as usual. If you do not own uninstalled Augmentations then the game will not reset.
   *
   * @param cbScript - This is a script that will automatically be run after Augmentations are installed (after the reset). This script will be run with no arguments and 1 thread. It must be located on your home computer.
   */
  installAugmentations(cbScript?: string): Promise<void>;

  /**
   * Hospitalize the player.
   * @remarks
   * RAM cost: 0.25 GB * 16/4/1
   */
  hospitalize(): Promise<void>;

  /**
   * Soft reset the game.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * This function will perform a reset even if you don’t have any augmentation installed.
   *
   * @param cbScript - This is a script that will automatically be run after Augmentations are installed (after the reset). This script will be run with no arguments and 1 thread. It must be located on your home computer.
   */
  softReset(cbScript: string): Promise<void>;

  /**
   * Go to a location.
   * @remarks
   * RAM cost: 5 GB * 16/4/1
   *
   *
   * Move the player to a specific location.
   *
   * @param locationName - Name of the location.
   * @returns True if the player was moved there, false otherwise.
   */
  goToLocation(locationName: LocationName | `${LocationName}`): Promise<boolean>;

  /**
   * Get the current server.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * @returns Name of the current server.
   */
  getCurrentServer(): Promise<string>;

  /**
   * Connect to a server.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * Run the connect HOSTNAME command in the terminal. Can only connect to neighbors.
   *
   * @returns True if the connect command was successful, false otherwise.
   */
  connect(hostname: string): Promise<boolean>;

  /**
   * Run the hack command in the terminal.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * @returns Amount of money stolen by manual hacking.
   */
  manualHack(): Promise<Promise<number>>;

  /**
   * Run the backdoor command in the terminal.
   * @remarks
   * RAM cost: 2 GB * 16/4/1
   *
   *
   * @returns Promise waiting for the installation to finish.
   */
  installBackdoor(): Promise<Promise<void>>;

  /**
   * Check if the player is focused.
   * @remarks
   * RAM cost: 0.1 GB * 16/4/1
   *
   *
   * @returns True if the player is focused.
   */
  isFocused(): Promise<boolean>;

  /**
   * Set the players focus.
   * @remarks
   * RAM cost: 0.1 GB * 16/4/1
   *
   * @returns True if the focus was changed.
   */
  setFocus(focus: boolean): Promise<boolean>;

  /**
   * Get a list of programs offered on the dark web.
   * @remarks
   * RAM cost: 1 GB * 16/4/1
   *
   *
   * This function allows the player to get a list of programs available for purchase
   * on the dark web. Players MUST have purchased Tor to get the list of programs
   * available. If Tor has not been purchased yet, this function will return an
   * empty list.
   *
   * @example
   * ```js
   * const programs = ns.singularity.getDarkwebPrograms();
   * ns.tprint(`Available programs are: ${programs}`);
   * ```
   * @returns - a list of programs available for purchase on the dark web, or [] if Tor has not
   * been purchased
   */
  getDarkwebPrograms(): Promise<string[]>;

  /**
   * Check the price of an exploit on the dark web
   * @remarks
   * RAM cost: 0.5 GB * 16/4/1
   *
   *
   * This function allows you to check the price of a darkweb exploit/program.
   * You MUST have a TOR router in order to use this function. The price returned
   * by this function is the same price you would see with buy -l from the terminal.
   * Returns the cost of the program if it has not been purchased yet, 0 if it
   * has already been purchased, or -1 if Tor has not been purchased (and thus
   * the program/exploit is not available for purchase).
   *
   * If the program does not exist, an error is thrown.
   *
   *
   * @example
   * ```js
   * const programName = "BruteSSH.exe";
   * const cost = ns.singularity.getDarkwebProgramCost(programName);
   * if (cost > 0) ns.tprint(`${programName} costs $${ns.formatNumber(cost)}`);
   * ```
   * @param programName - Name of program to check the price of
   * @returns Price of the specified darkweb program
   * (if not yet purchased), 0 if it has already been purchased, or -1 if Tor has not been
   * purchased. Throws an error if the specified program/exploit does not exist
   */
  getDarkwebProgramCost(programName: string): Promise<number>;

  /**
   * b1t_flum3 into a different BN.
   * @remarks
   * RAM cost: 16 GB * 16/4/1
   *
   * @param nextBN - BN number to jump to
   * @param callbackScript - Name of the script to launch in the next BN.
   * @param bitNodeOptions - BitNode options for the next BN.
   */
  b1tflum3(nextBN: number, callbackScript?: string, bitNodeOptions?: BitNodeOptions): Promise<void>;

  /**
   * Destroy the w0r1d_d43m0n and move on to the next BN.
   * @remarks
   * RAM cost: 32 GB * 16/4/1
   *
   * You must have the special augment installed and the required hacking level
   *   OR
   * Completed the final black op.
   *
   * @param nextBN - BN number to jump to
   * @param callbackScript - Name of the script to launch in the next BN.
   * @param bitNodeOptions - BitNode options for the next BN.
   */
  destroyW0r1dD43m0n(nextBN: number, callbackScript?: string, bitNodeOptions?: BitNodeOptions): Promise<void>;

  /**
   * Get the current work the player is doing.
   * @remarks
   * RAM cost: 0.5 GB * 16/4/1
   *
   * @returns - An object representing the current work. Fields depend on the kind of work.
   */
  getCurrentWork(): Promise<Task | null>;
}
