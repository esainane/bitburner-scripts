import { CrimeType, NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  const crime: string = ns.args[0] as string ?? 'Homicide';
  try {
    const crime_stats = ns.singularity.getCrimeStats(crime as CrimeType);
    ns.tprint(crime_stats);
} catch (e) {
    ns.tprint(e);
}
}
