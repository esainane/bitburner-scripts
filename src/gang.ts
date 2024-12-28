import { EquipmentStats, GangGenInfo, GangMemberAscension, GangMemberInfo, NS } from '@ns'

const ms_per_second = 1000;
const ms_per_minute = ms_per_second * 60;

// Configuration

// Ascend if we improve upon relevant multipliers by a ratio of this much
const ascend_improvement_required = 1.4;
// ...but do not ascend if losing a member would result in a loss of respect greater than this much
const ascend_preserve_respect_ratio = 0.3;

// Buy equipment for a gang member if the cost of the equipment is less than this much of the player's current money
const equipment_cost_ratio = 0.03;
// Augmentations are much more expensive, but permanent and very powerful, so we're quicker to spend larger sum
// on them.
const aug_cost_ratio = 0.3;
// If Formulas.exe is not available, use this as the average relevant skill threshold which, when below, a character
// attempting to do an advanced task should instead do the basic task
const no_formulas_starter_skill_threshold = 150;
// Do not do anything except train until we reach an average of this unmodified relevant skill value
// Very early game uses a different approach to gain respect and members quickly which does not involve this value
const train_premult_skill_threshold = 160;
// Early game has very different goals. You still want to train people out of the very unproductive stages quickly,
// but you want to swap over to respect generating activities ASAP in order to get more members starting their own
// training cycles. At a rate of 6 levels per member, the thresholds go 18, 24, and 30, for 3, 4, and 5 members.
const early_train_premult_skill_per_member_threshold = 6;
// How often should we sample member stats to determine skill growth rate?
const skill_growth_sample_rate_ms = ms_per_second * 20;
// If the multiplier from the wanted penalty drops below this threshold, address this penalty directly
const wanted_penality_threshold = 0.99;
// Prioritize making money if the player has less than this much money
// Default set to have enough money for the port crackers, a moderately sized server, or automatic purchase of basic gang equipment
const player_low_money_threshold = 300e6;
// Steamroll strategy for gang warfare:
// Build up poewr to an overwhelming level, then unassign everyone from building gang poewr and engage gang warfare
// until our winrate is no longer overwhelming
const gang_warfare_steamroll_threshold_start = 0.9;
const gang_warfare_steamroll_threshold_abort = 0.8;
const gang_warfare_steamroll_power_buffer_minimum = 500;
// Respect continues to be useful for pretty much the entire time, but you get pretty marginal returns towards the
// end. The equipment discount hits 90% when respect reaches around 5e7, and 99% when respect reaches around 5e8.
// Use these as "soft" and "hard" caps for when we should stop really pushing for respect, and switching to money
// instead. As always, the member with the least respect will continue to perform the respect gaining task, and
// additionally any member with less than (1 - ascend_preserve_respect_ratio) / 11 respect will perform the respect
// gaining task, to make sure we don't have any "too big to ascend" members stagnating.
const soft_respect_cap = 5e7;
const hard_respect_cap = 5e8;


// Random gang member names
// "I am not a number! I am a free man!" - #6
const names = [
  [ 'Alice', 'Alan', 'Amanda', 'Andrew', 'Angela', 'Anna', 'Anthony', 'Ashley' ],
  [ 'Bob', 'Barbara', 'Benjamin', 'Betty', 'Brandon', 'Brenda', 'Brian', 'Brittany' ],
  [ 'Carol', 'Carl', 'Catherine', 'Charles', 'Cheryl', 'Chris', 'Christina', 'Christopher' ],
  [ 'Daniel', 'David', 'Deborah', 'Debra', 'Denise', 'Dennis', 'Diana', 'Diane' ],
  [ 'Eve', 'Edward', 'Elizabeth', 'Emily', 'Eric', 'Ethan', 'Eugene', 'Evelyn', 'Evan' ],
  [ 'Frank', 'Fred' ],
  [ 'Gabriel', 'Gary', 'George', 'Gerald', 'Gloria', 'Grace' ],
  [ 'Hannah', 'Harold', 'Harry', 'Heather', 'Helen', 'Henry', 'Howard' ],
  [ 'Ian', 'Isaac', 'Ivan' ],
  [ 'Jacob', 'James', 'Joanne', 'John', 'Julia' ],
  [ 'Kyle', 'Kim', 'Katerina' ],
  [ 'Lambert', 'Leon', 'Luna', 'Lycos' ],
];

interface GangStrategy {
  equipment_has_relevant_stats: (ns: NS, stats: EquipmentStats) => boolean;
  average_relevant_skill: (ns: NS, member: GangMemberInfo) => number;
  average_relevant_premult_skill: (ns: NS, member: GangMemberInfo) => number;
  average_relevant_improvement: (ns: NS, ascension: GangMemberAscension) => number;
  training_activity: string;
  starter_activity: string;
  respect_activity: string;
  money_activity: string;
  dewanted_activity: string;
}

let strategy: GangStrategy;

// Misc


function assign_gang_task(ns: NS, member: string, task: string) {
  const current_task = ns.gang.getMemberInformation(member).task;
  if (task !== current_task) {
    ns.gang.setMemberTask(member, task);
  }
}

export async function main(ns: NS): Promise<void> {
  if (!ns.gang.inGang()) {
    ns.tprint("ERROR Not in a gang!");
  }

  ns.disableLog('ALL');

  strategy = ns.gang.getGangInformation().isHacking
    ? {
      equipment_has_relevant_stats: (ns: NS, stats: EquipmentStats) => ((stats.hack ?? 0) > 1),
      average_relevant_skill: (ns: NS, member: GangMemberInfo) => member.hack,
      average_relevant_premult_skill: (ns: NS, member: GangMemberInfo) => member.hack / member.hack_mult / member.hack_asc_mult,
      average_relevant_improvement: (ns, ascension) => ascension.hack,
      training_activity: 'Train Hacking',
      // TODO: Fill out hacker hang activities
      starter_activity: '',
      respect_activity: '',
      money_activity: '',
      dewanted_activity: 'Ethical Hacking',
    } : {
      equipment_has_relevant_stats: (ns: NS, stats: EquipmentStats) => [stats.str, stats.def, stats.dex, stats.agi].some(d => (d ?? 0) > 1),
      average_relevant_skill: (ns: NS, member: GangMemberInfo) => [member.str, member.def, member.dex, member.agi].reduce((a, b) => a + b) / 4,
      average_relevant_premult_skill: (ns: NS, member: GangMemberInfo) => [member.str / (member.str_mult * member.str_asc_mult), member.def / (member.def_mult * member.def_asc_mult), member.dex / (member.dex_mult * member.dex_asc_mult), member.agi / (member.agi_mult * member.agi_asc_mult)].reduce((a, b) => a + b) / 4,
      average_relevant_improvement: (ns, ascension) => [ascension.str, ascension.def, ascension.dex, ascension.agi].reduce((a, b) => a + b) / 4,
      training_activity: 'Train Combat',
      starter_activity: 'Mug People',
      respect_activity: 'Terrorism',
      money_activity: 'Human Trafficking',
      dewanted_activity: 'Vigilante Justice',
    };
  const all_equipment_available = ns.gang.getEquipmentNames();
  const equipment_available = all_equipment_available.filter((name) => strategy.equipment_has_relevant_stats(ns, ns.gang.getEquipmentStats(name)));
  // Sort by cheapest first
  equipment_available.sort((a, b) => ns.gang.getEquipmentCost(a) - ns.gang.getEquipmentCost(b));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await ns.asleep(5000);
    const info: GangGenInfo = ns.gang.getGangInformation();
    if (!info) {
      ns.tprint("No gang information available (has a gang been created?)");
    }

    // Universals, regardless of game state

    const total_respect = info.respect;

    // If we can recruit another gang member, do so
    while (ns.gang.canRecruitMember()) {
      const current_member_count = ns.gang.getMemberNames().length;
      const candidates = names[current_member_count];
      const selected_name = candidates[Math.floor(Math.random() * candidates.length)];
      ns.gang.recruitMember(selected_name);
    }

    // The list of members is now fixed for this cycle
    const members: readonly [string, GangMemberInfo][] = ns.gang.getMemberNames().map(d => [d, ns.gang.getMemberInformation(d)]);

    // Ascend anyone that wants to ascend
    for (const [name, info] of members) {
      // Check to see if there are any gang members which want to ascend
      // A gang member wants to ascend if doing so would improve their relevant multipliers by the configured threshold
      const ascension_result: GangMemberAscension | undefined = ns.gang.getAscensionResult(name);
      if (!ascension_result) {
        // Can't ascend at this time
        continue;
      }
      if (ascension_result.respect > total_respect * ascend_preserve_respect_ratio) {
        // Too important to lose right now
        continue;
      }
      const improvement_factor = strategy.average_relevant_improvement(ns, ascension_result);
      if (improvement_factor > ascend_improvement_required) {
        ns.tprint(`Ascending member ${name} for an average ${improvement_factor}x ascension multiplier improvement`);
        ns.gang.ascendMember(name);
        continue;
      }
    }

    let fully_upgraded = true;
    // Check to see if we can purchase relevant equipment for any member, by equipment cost
    for (const equipment of equipment_available) {
      const cost = ns.gang.getEquipmentCost(equipment);
      // If this is too expensive for what we have, stop looking
      const is_aug = ns.gang.getEquipmentType(equipment) === "Augmentation";
      const cost_ratio = is_aug ? aug_cost_ratio : equipment_cost_ratio;
      if (cost > ns.getPlayer().money * cost_ratio) {
        fully_upgraded = false;
        break;
      }
      // Check to see if any member doesn't have this yet
      for (const [name, info] of members) {
        // If this is (or has become) too expensive for what we have, stop looking
        // Aug costs being different theoretically breaks order, but in practice augs are far more expensive than
        // anything else anyway.
        if (cost > ns.getPlayer().money * cost_ratio) {
          fully_upgraded = false;
          break;
        }
        const upgrades_of_type = is_aug ? info.augmentations : info.upgrades;
        if (upgrades_of_type.includes(equipment)) {
          continue;
        }
        // If they don't have it, buy it
        const result = ns.gang.purchaseEquipment(name, equipment);
        if (!result) {
          ns.tprint(`WARNING Failed to purchase ${equipment} for ${name}`);
        }
      }
      // Sort of abuse the flag to break out of the outer loop too
      if (!fully_upgraded) {
        break;
      }
    }

    // Get other gang information about gangs which aren't defeated
    // The returned array also contains an entry for us, so filter that out too.
    const other_gangs = [...Object.entries(ns.gang.getOtherGangInformation())].filter(([n, d]) => n !== info.faction && d.territory !== 0);
    const have_monopoly = other_gangs.length === 0;
    const worst_clash_chance = Math.min(...other_gangs.map(
      ([n, d])=>ns.gang.getChanceToWinClash(n)
    ));
    const worst_power_delta = Math.min(...other_gangs.map(
      ([n, d])=>info.power - d.power
    ));

    // Early safety check: If we're engaging in gang warfare and our winrate is not overwhelming, stop gang warfare
    // Also stop it if it is all done
    if (info.territoryWarfareEngaged && (have_monopoly || worst_clash_chance < gang_warfare_steamroll_threshold_abort || worst_power_delta < gang_warfare_steamroll_power_buffer_minimum)) {
      ns.gang.setTerritoryWarfare(false);
    }

    // If it's the very early game, the most important goal is building respect and getting more members
    // If we have less than six members, focus on the starter activity to balance experience growth and respect gain
    const early_game = members.length < 6;

    const sort_by_respect = ([lname, l]: [string, GangMemberInfo], [rname, r]: [string, GangMemberInfo]) => {
      return r.earnedRespect - l.earnedRespect;
    };

    const starter_activity_stats = ns.gang.getTaskStats(strategy.starter_activity);
    const money_activity_stats = ns.gang.getTaskStats(strategy.money_activity);
    const respect_activity_stats = ns.gang.getTaskStats(strategy.respect_activity);

    const make_money = ns.fileExists('Formulas.exe')
      ? (n: string, m: GangMemberInfo) => ns.formulas.gang.moneyGain(info, m, money_activity_stats) < ns.formulas.gang.moneyGain(info, m, starter_activity_stats)
        ? assign_gang_task(ns, n, strategy.starter_activity)
        : assign_gang_task(ns, n, strategy.money_activity)
      : (n: string, m: GangMemberInfo) => strategy.average_relevant_skill(ns, m) > no_formulas_starter_skill_threshold
      ? assign_gang_task(ns, n, strategy.money_activity)
      : assign_gang_task(ns, n, strategy.starter_activity);
    const make_respect = ns.fileExists('Formulas.exe')
      ? (n: string, m: GangMemberInfo) => ns.formulas.gang.respectGain(info, m, respect_activity_stats) < ns.formulas.gang.respectGain(info, m, starter_activity_stats)
        ? assign_gang_task(ns, n, strategy.starter_activity)
        : assign_gang_task(ns, n, strategy.respect_activity)
      : (n: string, m: GangMemberInfo) => strategy.average_relevant_skill(ns, m) > no_formulas_starter_skill_threshold
        ? assign_gang_task(ns, n, strategy.respect_activity)
        : assign_gang_task(ns, n, strategy.starter_activity);


    // Now, assign all tasks
    // First determine who is growing and who should be assigned a productive task
    const growing_members: [string, GangMemberInfo][] = [];
    const trained_members: [string, GangMemberInfo][] = [];
    const premult_skill_threshold = early_game ? early_train_premult_skill_per_member_threshold * members.length : train_premult_skill_threshold;
    for (const [name, info] of members) {
      // If a member is growing at a reasonable rate, or is still very new, keep training
      //if (!early_game && (growth_per_minute > minimum_skill_growth_ratio || strategy.average_relevant_skill(ns, info) < minimum_ascend_multiplier)) {
      if (strategy.average_relevant_premult_skill(ns, info) < premult_skill_threshold) {
        growing_members.push([name, info]);
      } else {
        trained_members.push([name, info]);
      }
    }

    // All growing members must keep training
    for (const [name, info] of growing_members) {
      assign_gang_task(ns, name, strategy.training_activity);
    }
    // And if we don't have any trained members, that's it
    if (!trained_members.length) {
      continue;
    }
    // Sort all trained members by respect descending
    trained_members.sort(sort_by_respect);

    // Strategy for trained members:
    // - If the current wanted penalty is non-trivial, perform the goodguy activity to reduce it
    //   This shouldn't normally happen, but we do want to handle this case to avoid getting stuck in a tarpit if
    //   we somehow lose most of our respect.
    //   This can happen occassionally early on, when you don't have much respect to offset the wanted level.
    //   Here, we put wantedLevel into a slowly decaying curve so as to avoid taking this over just increasing respect
    //   unless it's either very early on, or we've unexpectedly lost far too much respect
    if (info.wantedPenalty < wanted_penality_threshold && info.wantedLevel ** 0.7 > Math.max(1.1, info.respect / 6)) {
      // ALL HANDS
      for (const [name, info] of trained_members) {
        assign_gang_task(ns, name, strategy.dewanted_activity);
      }
      continue;
    }

    // - If we're not stuck in a wanted penalty tarpit, always have at least one member dedicated to earning respect
    //   Here, the least respected trained member
    make_respect(...trained_members.pop()!);

    // - If we don't yet have all members, focus on gaining respect
    if (ns.gang.respectForNextRecruit() !== Infinity) {
      for (const [name, info] of trained_members) {
        make_respect(name, info);
      }
      continue;
    }

    // - If the player is critically low on funds, focus on making money
    if (ns.getPlayer().money < player_low_money_threshold) {
      for (const [name, info] of trained_members) {
        make_money(name, info);
      }
      continue;
    }

    // If we don't yet own all territory...
    if (!have_monopoly) {
      // - If we've built up a decisive lead in territory winrate against all factions, stop preparing power
      //   (do not have any members engaging in territory warfare while clash chance is nonzero)
      if (worst_power_delta > gang_warfare_steamroll_power_buffer_minimum && worst_clash_chance > gang_warfare_steamroll_threshold_start) {
        ns.gang.setTerritoryWarfare(true);
        // ! Fall through to assign tasks below
      } else if (fully_upgraded && !info.territoryWarfareEngaged && info.territoryClashChance === 0) {
        // - If all equipment has been purchased, start preparing power for territory clashes, provided there is no
        //   lingering risk of fatalities
        for (const [name, info] of trained_members) {
          assign_gang_task(ns, name, 'Territory Warfare');
        }
        continue;
      }
    }

    // If we're "done", having effectively maxed out the meaningful respect discount effect, just focus on making money
    if (info.respect > (fully_upgraded ? soft_respect_cap : hard_respect_cap)) {
      for (const [name, info] of trained_members) {
        if (info.earnedRespect < (1 - ascend_preserve_respect_ratio) / (members.length - 1)) {
          // But if we might cause a member to stagnate, because our respect is so low that if everyone else except one
          // had it then that one would have a load-bearing proportion of respect, earn more respect until everyone is
          // definitely free to ascend when available
          make_respect(name, info);
          continue;
        }
        make_money(name, info);
      }
      continue;
    }

    // By default, engage in balanced money and respect growth
    // This could be coordinated if we keep track of revenue sources, and deprioritize gang revenue if we're not
    // capable of making much, relatively speaking
    let assigned_respect = Math.floor(trained_members.length / 2);

    while (assigned_respect--) {
      make_respect(...trained_members.pop()!);
    }
    while (trained_members.length > 0) {
      make_money(...trained_members.pop()!);
    }
  }
}
