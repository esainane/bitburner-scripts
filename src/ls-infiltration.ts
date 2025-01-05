import { NS } from '@ns'
import { colors, format_number, format_servername, print_table } from '/lib/colors';
import { format_currency } from '/lib/format-money';

export async function main(ns: NS): Promise<void> {
    ns.tprint('Infiltration targets:');
    const infiltration_targets = ns.infiltration.getPossibleLocations().flatMap(d=>ns.infiltration.getInfiltration(d.name)).sort((l,r) =>
         l.difficulty !== r.difficulty
            ? l.difficulty - r.difficulty
            : l.startingSecurityLevel !== r.startingSecurityLevel
                ? l.startingSecurityLevel - r.startingSecurityLevel
                : l.maxClearanceLevel - r.maxClearanceLevel);
    const argopts = [];
    argopts[2] = { left: false }
    print_table(ns, (ns: NS) => {
        for (const target of infiltration_targets) {
            ns.tprintf(`%s in %s: difficulty %s; levels %s; rewards: %s/%s rep, %s ${colors.fg_cyan}SoA${colors.reset} rep; starting security %s`,
                format_servername(target.location.name),
                `${colors.fg_cyan}${target.location.city}${colors.reset}`,
                format_number(target.difficulty, {round: 2}),
                format_number(target.maxClearanceLevel),
                format_currency(target.reward.sellCash),
                format_number(Math.floor(target.reward.tradeRep)),
                format_number(Math.floor(target.reward.SoARep)),
                format_number(target.startingSecurityLevel)
            );
        }
    }, argopts);
}
