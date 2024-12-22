import { NS } from '@ns'
import { format_number, format_servername, print_table } from '/lib/colors';
import { currency_format } from '/lib/format-money';

export async function main(ns: NS): Promise<void> {
    ns.tprint('Infiltration targets:');
    const infiltration_targets = ns.infiltration.getPossibleLocations().flatMap(d=>ns.infiltration.getInfiltration(d.name)).sort((l,r) =>
         l.difficulty !== r.difficulty
            ? l.difficulty - r.difficulty
            : l.startingSecurityLevel !== r.startingSecurityLevel
                ? l.startingSecurityLevel - r.startingSecurityLevel
                : l.maxClearanceLevel - r.maxClearanceLevel);
    print_table(ns, (ns: NS) => {
        for (const target of infiltration_targets) {
            ns.tprintf("%s in %s: difficulty %s; levels %s; rewards: %s/%s rep, %s SoA rep; starting security %s",
                format_servername(target.location.name),
                target.location.city,
                format_number(target.difficulty),
                format_number(target.maxClearanceLevel),
                currency_format(target.reward.sellCash),
                format_number(Math.floor(target.reward.tradeRep)),
                format_number(Math.floor(target.reward.SoARep)),
                format_number(target.startingSecurityLevel)
            );
        }
    });
}
