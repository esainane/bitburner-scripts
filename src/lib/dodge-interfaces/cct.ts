import { CodingContractData } from "@ns";

/**
 * Singularity API, but all functions are async worker-launchers
 *
 *
 * To update:
    sed -i -e '/^ \*\//q' src/lib/dodge-interfaces/cct.ts ;
    sed -ne '/^export interface CodingContract {$/,/^}$/{s/\bCodingContract\b/CodingContractAsync/;s/\( *\)\([^* ]*[^(]*(\)/\1dodge_\2/;s/^\( *[^* ]*.*): \)\([^()]\+\);$/\1Promise<\2>;/;p}' NetScriptDefinitions.d.ts >> src/lib/dodge-interfaces/cct.ts
 */
export interface CodingContractAsync {
  /**
   * Attempts a coding contract, returning a reward string on success or empty string on failure.
   * @remarks
   * RAM cost: 10 GB
   *
   * Attempts to solve the Coding Contract with the provided solution.
   *
   * @example
   * ```js
   dodge_* const reward = ns.codingcontract.attempt(yourSolution, filename, hostname);
   dodge_* if (reward) {
   dodge_*   ns.tprint(`Contract solved successfully! Reward: ${reward}`);
   * } else {
   dodge_*   ns.tprint("Failed to solve contract.");
   * }
   * ```
   *
   * @param answer - Attempted solution for the contract.
   * @param filename - Filename of the contract.
   * @param host - Hostname of the server containing the contract. Optional. Defaults to current server if not
   *   provided.
   * @returns A reward description string on success, or an empty string on failure.
   */
  dodge_attempt(answer: string | number | any[], filename: string, host?: string): Promise<string>;

  /**
   * Get the type of a coding contract.
   * @remarks
   * RAM cost: 5 GB
   *
   * Returns a name describing the type of problem posed by the Coding Contract.
   dodge_* (e.g. Find Largest Prime Factor, Total Ways to Sum, etc.)
   *
   * @param filename - Filename of the contract.
   * @param host - Hostname of the server containing the contract. Optional. Defaults to current server if not provided.
   * @returns Name describing the type of problem posed by the Coding Contract.
   */
  dodge_getContractType(filename: string, host?: string): Promise<string>;

  /**
   * Get the description.
   * @remarks
   * RAM cost: 5 GB
   *
   * Get the full text description for the problem posed by the Coding Contract.
   *
   * @param filename - Filename of the contract.
   * @param host - Hostname of the server containing the contract. Optional. Defaults to current server if not provided.
   * @returns Contract’s text description.
   */
  dodge_getDescription(filename: string, host?: string): Promise<string>;

  /**
   * Get the input data.
   * @remarks
   * RAM cost: 5 GB
   *
   * Get the data associated with the specific Coding Contract.
   * Note that this is not the same as the contract’s description.
   * This is just the data that the contract wants you to act on in order to solve the contract.
   *
   * @param filename - Filename of the contract.
   * @param host - Host of the server containing the contract. Optional. Defaults to current server if not provided.
   * @returns The specified contract’s data, data type depends on contract type.
   */
  dodge_getData(filename: string, host?: string): Promise<CodingContractData>;

  /**
   * Get the number of attempts remaining.
   * @remarks
   * RAM cost: 2 GB
   *
   * Get the number of tries remaining on the contract before it self-destructs.
   *
   * @param filename - Filename of the contract.
   * @param host - Hostname of the server containing the contract. Optional. Defaults to current server if not provided.
   * @returns How many attempts are remaining for the contract.
   */
  dodge_getNumTriesRemaining(filename: string, host?: string): Promise<number>;

  /**
   * Generate a dummy contract.
   * @remarks
   * RAM cost: 2 GB
   *
   * Generate a dummy contract on the home computer with no reward. Used to test various algorithms.
   *
   * @param type - Type of contract to generate
   * @returns Filename of the contract.
   */
  dodge_createDummyContract(type: string): Promise<string>;

  /**
   * List all contract types.
   * @remarks
   * RAM cost: 0 GB
   */
  dodge_getContractTypes(): Promise<string[]>;
}
