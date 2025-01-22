import { AutocompleteData, FilenameOrPID, NS, ScriptArg } from '@ns'
import { ThreadAllocator } from '/lib/thread-allocator';
import { singularity_async } from './lib/dodge/singu';
import { get_aug_args } from '/lib/aug-bitnode-strategies';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function autocomplete(data : AutocompleteData, args : string[]) : string[] {
  return ['--aug-strategy='];
}

async function wait_for_script_finish(ns: NS, script: FilenameOrPID, host?: string, ...args: ScriptArg[]) {
  while (ns.isRunning(script, host, ...args)) {
    await ns.sleep(500);
  }
}

export async function main(ns: NS): Promise<void> {
  const skip_finalize = ns.args.includes('--skip-finalize');
  const override_strategy = ns.args.map(String).filter(d => d.startsWith('--aug-strategy=')).map(d => d.split('=', 1)[0])[0];

  const singu = singularity_async(ns);

  if (!skip_finalize) {
    // Kill all running scripts here
    ns.killall('home', true);
    // Do some final things which are sometimes forgotton
    const final_scripts = [
      // Kill all usual scripts elsewhere
      ['kill.js'],
      // Gain all outstanding money
      ['ccts.js', '--live', '--force'], // Complete all outstanding coding contracts, regardless of attempts remaining
      ['wse.js', '--sell'], // Sell all remaining stocks
      ['hacknet.js', '--sell'], // Sell all hashes
      // Spend all available money
      ['sleeve-augs.js'], // Buy any augmentations available for sleeves
      ['aug.js', '--live', // Buy any augmentations for the player; priorities determine which augmentations are selected, but the script will buy them in optimal order
        ...get_aug_args(override_strategy !== undefined ? parseInt(override_strategy) : ns.getResetInfo().currentNode)
        // TODO: When Neuroflux Governer handling is added, add it here, and finish with The Red Pill.
        // We currently may be reducing the number of Neuroflux Governors we could be buying by buying
        // The Red Pill (which, while important, has no monetary cost) early.
      ],
      ['flux.js'], // Buy as many instances of Neuroflux Governor as available
      ['upgrade-home.js'], // Buy all available upgrades for home RAM
      ['donate.js', '--auto'], // Donate any remaining money to any available faction taking donations
    ];
    for (const [script, ...args] of final_scripts) {
      do {
        await ns.asleep(500);
        const allocator = new ThreadAllocator(ns, new Set(), new Set());
        const [threads, pids] = await allocator.allocateThreads(script, { threads: 1, temporary: true }, false, ...args);
        if (!pids.length) {
          // Try again
          continue;
        }
        await wait_for_script_finish(ns, pids[0]);
        break;
      // eslint-disable-next-line no-constant-condition
      } while (true);
    }
    // We get a modest intelligence boost from accepting faction invites over API, so make sure we take advantage of
    // that before we reset. The usual downsides of joining useless factions (diluting coding contract reputation gain)
    // are irrelevant, because we're about to reset.
    const invites = await singu.dodge_checkFactionInvitations();
    for (const faction of invites) {
      await ns.asleep(500);
      await singu.dodge_joinFaction(faction);
    }
  }
  // Remove volatile data
  for (const vfile of ns.ls('home', 'data/').filter(d => d.startsWith('data/'))) {
    ns.rm(vfile, 'home');
  }
  ns.tprint('SUCCESS See you on the other side!');
  await ns.asleep(3000);
  // Prestige
  await singu.dodge_softReset('init.js');
  ns.tprint('ERROR Script still running after reset?');
}
