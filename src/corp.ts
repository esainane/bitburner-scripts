import { CorpStateName, NS } from '@ns'

/**
 * Corporation management script
 *
 * Very simple early strategy managing an Agriculture division.
 */

export async function main(ns: NS): Promise<void> {
  if (!ns.corporation.hasCorporation()) {
    const isBN3 = ns.getResetInfo().currentNode === 3;
    const success = ns.corporation.createCorporation('Smoke and Choke Incorporated', !isBN3);
    if (!success) {
      ns.tprint('ERROR: Failed to create corporation');
      return;
    }
  }
  const division_name = 'Agriculture';
  // If we don't have an agriculture divison yet, create it
  let agriculture_division;
  try{
   agriculture_division = ns.corporation.getDivision(division_name);
  } catch (e) {
    ns.corporation.expandIndustry(division_name, division_name);
    agriculture_division = ns.corporation.getDivision(division_name);
  }

  // If we don't have smart supply yet, buy it
  if (!ns.corporation.hasUnlock('Smart Supply')) {
    ns.corporation.purchaseUnlock('Smart Supply');
  }

  // If we're not in six cities yet, expand to them
  for (const city of Object.values(ns.enums.CityName)) {
    await ns.asleep(200);
    let office;
    try {
      office = ns.corporation.getOffice(division_name, city);
    } catch (e) {
      ns.corporation.expandCity(division_name, city);
      office = ns.corporation.getOffice(division_name, city);
    }
    // Ensure we have at least four positions in each office
    while (office.size < 4) {
      await ns.asleep(200);
      ns.corporation.upgradeOfficeSize(division_name, city, 1);
      office = ns.corporation.getOffice(division_name, city);
    }
    // Ensure we have at least four employees in each office
    while (office.numEmployees < 4) {
      await ns.asleep(200);
      ns.corporation.hireEmployee(division_name, city);
      office = ns.corporation.getOffice(division_name, city);
    }
    // Ensure at least one in each critical position
    for (const position of ns.corporation.getConstants().employeePositions) {
      // First, free up spaces
      ns.corporation.setAutoJobAssignment(division_name, city, position, 0);
    }
    // Then assign 1 to engineering, business, and management, and the rest to operations
    ns.corporation.setAutoJobAssignment(division_name, city, 'Operations', office.numEmployees - 3);
    ns.corporation.setAutoJobAssignment(division_name, city, 'Engineer', 1);
    ns.corporation.setAutoJobAssignment(division_name, city, 'Business', 1);
    ns.corporation.setAutoJobAssignment(division_name, city, 'Management', 1);
    // If we don't have a warehouse, buy one
    if (!ns.corporation.hasWarehouse(division_name, city)) {
      ns.corporation.purchaseWarehouse(division_name, city);
    }
    // Make sure smart supply is enabled
    ns.corporation.setSmartSupply(division_name, city, true);
    // Set smart supply to sell plants and food at market price
    ns.corporation.sellMaterial(division_name, city, 'Plants', 'MAX', 'MP');
    ns.corporation.sellMaterial(division_name, city, 'Food', 'MAX', 'MP');
  }

  // We're now in all cities, and have a warehouse in each

  // Ensure we have at least two levels of adverts
  while (agriculture_division.numAdVerts < 2) {
    await ns.asleep(200);
    ns.corporation.hireAdVert(division_name);
    agriculture_division = ns.corporation.getDivision(division_name);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const state: CorpStateName = await ns.corporation.nextUpdate();
    switch (state) {
      case 'START':
        break;
      case 'PURCHASE':
        break;
      case 'PRODUCTION':
        break;
      case 'EXPORT':
        break;
      case 'SALE':
        // Examine all offices.
        for (const city of Object.values(ns.enums.CityName)) {
          const office = ns.corporation.getOffice(division_name, city);
          // If the average morale is low, throw a party.
          if (office.avgMorale < 99) {
            // 1M per employee boosts morale by ~1%
            ns.corporation.throwParty(division_name, city, 1e6);
          }
          // If the average energy is low, buy tea.
          if (office.avgEnergy < 99) {
            ns.corporation.buyTea(division_name, city);
          }
        }
        break;
    }
  }
}
