import { CityName, CorpIndustryData, CorpIndustryName, CorpMaterialName, CorpStateName, Division, Material, NS, Office, Product } from '@ns'
import { binary_search } from '/lib/binary-search';
import { panic } from '/lib/panic';
import { PriorityQueue } from '/lib/priority-queue';
import { format_currency } from '/lib/format-money';

/**
 * Corporation management script
 *
 * Very simple early strategy managing an Agriculture division.
 */

const seconds_per_cycle = 10;

// Head city for Products industries, selected arbitrarily
const head_city: `${CityName}` = 'Sector-12';

// Export string for a city to move output materials as input materials to a sister city
const export_material_to_material = '(IPROD+IINV/10)*(-1)';
// Export string for each city to move output materials as input materials to the head city
const export_material_to_product_head_city = '(IPROD+IINV/10)*(-1)/6';

type ExportConfig = [string, string[]]

// Exporting Industry -> [Product -> [Importing Industries]]
const supply_chain = new Map<string, ExportConfig[]>([
  ['Agriculture', [['Plants', ['Tobacco', 'Chemical']]]],
  ['Chemical', [['Chemicals', ['Agriculture']]]],
  ['Water Utilities', [['Water', ['Agriculture', 'Chemical']]]],
  ['Computer Hardware', [['Hardware', ['Water Utilities', 'Mining']]]],
  ['Refinery', [['Metal', ['Computer Hardware']]]],
  ['Mining', [['Ore', ['Refinery']]]],
]);

// Precompute the inverse of the supply chain too - importer to a list of exporters
const importers = new Map<string, string[]>(
  supply_chain.entries().reduce((acc: [string, string[]][], [exporter, exports]) => {
    for (const [product, importers] of exports) {
      for (const importer of importers) {
        const idx = acc.findIndex(([name]) => name === importer);
        if (idx !== -1) {
          const [_, exporters] = acc[idx];
          exporters.push(exporter);
        } else {
          acc.push([importer, [exporter]]);
        }
      }
    }
    return acc;
  }, [] satisfies [string, string[]][]));

// Define key sink industry. This should be an industry capable of making products
const key_sink_industry = 'Tobacco';

// Precompute the rank of all industries involved in the supply chain from distance to the key sink industry
const industry_rank = new Map<string, number>(
  // Use a generator function to perform breadth first search via importers starting from key_sink_industry
  (function* () {
    let queue = [key_sink_industry];
    // Cycles and diamonds are expected, so we need to track what we've seen
    const seen = new Set<string>();
    let rank = 0;
    // BFS
    while (queue.length > 0) {
      const next_queue = [];
      for (const industry of queue) {
        if (seen.has(industry)) {
          continue;
        }
        seen.add(industry);
        yield [industry, rank];
        // Find all supplies, add them for the next rank
        const exporters = importers.get(industry);
        if (exporters) {
          next_queue.push(...exporters);
        }
      }
      // Move on to the next rank
      queue = next_queue;
      rank++;
    }
  })());


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
  let agriculture_division: Division;
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

  const optimize_price = (division: string, city: CityName, material: CorpMaterialName, sell_amount?: number) => {
    // Optimal markup, equivalent to Market-TA2
    const division_data = ns.corporation.getDivision(division);
    const industry_data = ns.corporation.getIndustryData(division_data.type);
    const material_data = ns.corporation.getMaterial(division, city, material);
    const material_const_data = ns.corporation.getMaterialData(material);
    const markup = material_const_data.baseMarkup;

    if (sell_amount === undefined) {
      sell_amount = material_data.stored;
    }

    const { quality } = material_data;
    const markup_limit = quality / markup;

    const item_factor = quality + 0.001;

    const office = ns.corporation.getOffice(division, city);
    const business_production = 1 + office.employeeProductionByJob.Business;
    // Advanced documentation incorrectly claims that the multiplier is 0.001; the actual code divides by 10000 (10e3)
    // Perhaps they were confused by 10e3 !== 10**3 (1e3 === 10**3)?
    const business_factor = business_production ** 0.26 + business_production / 10e3;

    const awareness_component = (division_data.awareness + 1) ** (industry_data.advertisingFactor ?? 0);
    const popularity_component = (division_data.popularity + 1) ** (industry_data.advertisingFactor ?? 0);
    const ratio_component = division_data.awareness === 0
      ? 0.01
      : Math.max(0.01, (division_data.popularity + 0.001) / division_data.awareness);

    const advert_factor = (awareness_component * popularity_component * ratio_component) ** 0.85;

    // Note:
    // - material_data.demand is only filled out if we have "Market Research - Demand" unlocked.
    // - material_data.competition is only filled out if we have "Market Research - Competition" unlocked.
    // TA2 is still so much better than TA1 that it's worth going through with this calculation using the most
    // pessimistic possible parameters here, underestimating the net penalized threshold. We won't always come up with
    // a price that improves on TA1 without these values - 0.1 can be much less than a real factor of eg 34, but
    // sometimes we will.
    const market_factor = Math.max(0.1, (material_data.demand ?? 0) * (100 - (material_data.competition ?? 100)) * 0.01);

    const bots_factor = (1 + 0.01) ** ns.corporation.getUpgradeLevel('ABC SalesBots');

    const total_factor = item_factor * business_factor * advert_factor * market_factor * bots_factor;

    let extra = markup_limit * Math.sqrt(total_factor / sell_amount);

    // Safety net: If something has gone wrong, or if the error from market_factor not having data (with upgrades
    // unavailble) dropped the sale value that low, use the safe value from Market-TA1 like pricing instead.
    if (isNaN(extra) || !isFinite(extra) || extra < markup_limit) {
      extra = markup_limit;
    }

    return `MP+${extra}`;
  };

  /**
   * Set net buy/sell amount for a material
   *
   * @param amount Negative to sell, positive to buy, 'MAX' to sell all. Defaults to 'MAX'.
   */
  const set_buysell_material = (division: string, city: CityName, material: CorpMaterialName, amount: number | string = 'MAX') => {
    if (typeof amount === 'string') {
      if (amount !== 'MAX') {
        panic(ns, `The only string that should be passed to set_buysell_material as amount is "MAX", received "${amount}"!`);
      }
      ns.corporation.sellMaterial(division, city, material, 'MAX', optimize_price(division, city, material));
      return;
    }

    if (amount === 0) {
      ns.corporation.sellMaterial(division, city, material, '0', 'MP');
      ns.corporation.buyMaterial(division, city, material, 0);
      return;
    }
    if (amount < 0) {
      ns.corporation.buyMaterial(division, city, material, 0);
      ns.corporation.sellMaterial(division, city, material, `${-amount}`, optimize_price(division, city, material, -amount));
    } else {
      ns.corporation.sellMaterial(division, city, material, '0', 'MP');
      ns.corporation.buyMaterial(division, city, material, amount);
    }
  };

  const ensure_sane_division = (division_name: string) => {
    const division_data = ns.corporation.getDivision(division_name);
    const industry = division_name as CorpIndustryName;
    const industry_data = ns.corporation.getIndustryData(industry);
    // If we're not in six cities yet, expand to them
    for (const city of Object.values(ns.enums.CityName)) {
      let office;
      try {
        office = ns.corporation.getOffice(division_name, city);
      } catch (e) {
        ns.corporation.expandCity(division_name, city);
        office = ns.corporation.getOffice(division_name, city);
      }
      // Ensure we have at least four positions in each office
      while (office.size < 4) {
        const old_size = office.size;
        ns.corporation.upgradeOfficeSize(division_name, city, 1);
        office = ns.corporation.getOffice(division_name, city);
        if (office.size === old_size) {
          // No money?
          // We should wait until the next cycle to try again
          return false;
        }
      }
      // Ensure we have at least four employees in each office
      while (office.numEmployees < office.size) {
        const old_count = office.numEmployees;
        ns.corporation.hireEmployee(division_name, city);
        office = ns.corporation.getOffice(division_name, city);
        if (office.numEmployees === old_count) {
          // No money?
          // We should wait until the next cycle to try again
          return false;
        }
      }
      // Ensure at least one in each critical position
      for (const position of ns.corporation.getConstants().employeePositions) {
        // First, free up spaces
        ns.corporation.setAutoJobAssignment(division_name, city, position, 0);
      }
      // If we don't have a warehouse, buy one
      if (!ns.corporation.hasWarehouse(division_name, city)) {
        ns.corporation.purchaseWarehouse(division_name, city);
        if (!ns.corporation.hasWarehouse(division_name, city)) {
          // No money?
          // We should wait until the next cycle to try again
          return false;
        }
      }
    }

    division_maintenance(division_name);
    return true;
  };

  const division_maintenance = (division_name: string) => {
    const division_data = ns.corporation.getDivision(division_name);
    const industry_data = ns.corporation.getIndustryData(division_data.type);
    for (const city of Object.values(ns.enums.CityName)) {
      const office = ns.corporation.getOffice(division_name, city);
      if (!industry_data.makesMaterials && city !== head_city) {
        //if (city !== head_city) {
          // If we make products, assign everything to R&D in support cities, and most to engineering in the head city
          // Support city
          ns.corporation.setAutoJobAssignment(division_name, city, 'Research & Development', office.numEmployees);
          // Make sure smart supply is *disabled*
          ns.corporation.setSmartSupply(division_name, city, false);
        /*} else {
          // Head city, selected arbitrarily

          // Constraint: O+E+B+M <= numEmployees
          // To maximise product development speed:
          //  Maximise f(O,E,B,M) = (E**0.34 + O**0.2) * (1+M/(1.2*(O+E+B+M)))

          // To maximise product quality:

          // TODO: Solve and implement; Use below logic for now
        }*/
      } else {
        // Regular material industry; or products in the Head city, selected arbitrarily
        const excess = office.numEmployees - 4;
        // Primarily engineering once we get big
        const nongineers = Math.floor(excess ** 0.67);
        const sales = Math.floor(nongineers / 3);
        const management = Math.floor((nongineers - sales) / 2);
        const ops = nongineers - sales - management;
        ns.corporation.setAutoJobAssignment(division_name, city, 'Business', 1 + sales);
        ns.corporation.setAutoJobAssignment(division_name, city, 'Management', 1 + management);
        ns.corporation.setAutoJobAssignment(division_name, city, 'Operations', 1 + ops);
        ns.corporation.setAutoJobAssignment(division_name, city, 'Engineer', 1 + excess - nongineers);
        // Make sure smart supply is enabled
        ns.corporation.setSmartSupply(division_name, city, true);
      }
    }
    // Make sure all output products are set to sell Maximum, via TA2 or a reusing a currently configured price
    const output_products = division_data.products;
    const has_ta2 = ns.corporation.hasResearched(division_name, 'Market-TA.II');
    for (const product_name of output_products) {
      if (has_ta2) {
        // sellProduct will assign to all cities if the last parameter is true
        ns.corporation.sellProduct(division_name, head_city, product_name, 'MAX', 'MP', true);
        ns.corporation.setProductMarketTA2(division_name, product_name, true);
      } else {
        // Copy the configuration from head_city, even if we don't have a head city for this type
        // (I don't want to deal with setting multiple configurations at once while experimenting)
        const product = ns.corporation.getProduct(division_name, head_city, product_name);
        const old_price = product.desiredSellPrice;
        const price = typeof old_price === "string" && old_price.length > 2 && old_price.startsWith('MP') && ['+', '*'].includes(old_price[2])
          ? old_price
          : 'MP';
        ns.corporation.sellProduct(division_name, head_city, product_name, 'MAX', price, true);
      }
    }
  };

  const sanitized_divisions = new Set<CorpIndustryName>();

  const reflow_exports = (exporter: string) => {
    const division_data = ns.corporation.getDivision(exporter);
    const industry_data = ns.corporation.getIndustryData(division_data.type);
    for (const city of division_data.cities) {
      if (!industry_data.makesMaterials) {
        panic(ns, `Exporter configured, but industry ${division_data.type} does not make materials!?`);
      }
      const outputs = industry_data.producedMaterials;
      if (!outputs) {
        panic(ns, `Exporter configured, but industry ${division_data.type} does not have outputs!?`);
      }
      // Cancel all existing exports
      for (const material of outputs) {
        const material_data: Material = ns.corporation.getMaterial(exporter, city, material);
        for (const export_order of material_data.exports) {
          ns.corporation.cancelExportMaterial(exporter, city, export_order.division, export_order.city, material);
        }
      }
      // Recreate all exports, in exactly the order/priority configured
      const config = supply_chain.get(exporter);
      if (!config) {
        // Nothing to do
        return;
      }
      for (const [material, importers] of config) {
        for (const importer of importers) {
          if (!sanitized_divisions.has(importer as CorpIndustryName)) {
            continue;
          }
          const importer_is_product_kind = !ns.corporation.getIndustryData(importer as CorpIndustryName).makesMaterials;
          if (importer_is_product_kind) {
            // For a product, each exporter exports 1/6th of demand to the head city
            ns.corporation.exportMaterial(exporter, city, importer, head_city, material, export_material_to_product_head_city);
          } else {
            // For materials, each division exports to its sister division in the same city
            ns.corporation.exportMaterial(exporter, city, importer, city, material, export_material_to_material);
          }
        }
      }
    }
  };

  const add_sanitized_division = (industry: CorpIndustryName) => {
    if (sanitized_divisions.has(industry)) {
      return;
    }
    sanitized_divisions.add(industry);

    // If we don't exporting available, nothing further to do
    if (!ns.corporation.hasUnlock('Export')) {
      return;
    }

    // Otherwise, see if this completes an edge in any part of our configured supply chain

    // See if we ourselves are an exporter
    const exports = supply_chain.get(industry);
    if (exports) {
      reflow_exports(industry);
    }

    // See what industries would export to us
    const exporters = importers.get(industry);
    if (exporters) {
      for (const exporter of exporters) {
        if (!sanitized_divisions.has(exporter as CorpIndustryName)) {
          continue;
        }
        reflow_exports(exporter);
      }
    }
  };

  while (!ensure_sane_division(division_name)) {
    await ns.asleep(10000);
  }

  // We're now in all cities, and have a warehouse in each

  // Ensure we have at least two levels of adverts
  while (agriculture_division.numAdVerts < 2) {
    await ns.asleep(200);
    ns.corporation.hireAdVert(division_name);
    agriculture_division = ns.corporation.getDivision(division_name);
  }

  // Precalculate boost material ratios
  const re_size = ns.corporation.getMaterialData('Real Estate').size;
  const hw_size = ns.corporation.getMaterialData('Hardware').size;
  const robo_size = ns.corporation.getMaterialData('Robots').size;
  const ai_size = ns.corporation.getMaterialData('AI Cores').size;
  const storage_per_material = Object.fromEntries(ns.corporation.getConstants().materialNames.map((name) =>
    [name, ns.corporation.getMaterialData(name).size]
  ));

  type BoostMaterial = 'Real Estate' | 'Hardware' | 'Robots' | 'AI Cores';
  type BoostSolution = {
    [key in BoostMaterial]: number;
  }
  const empty_boost_solution: BoostSolution = {
    'Real Estate': 0,
    'Hardware': 0,
    'Robots': 0,
    'AI Cores': 0,
  }
  const boost_optimizer = (industry: CorpIndustryName)=> {
    const data: CorpIndustryData = ns.corporation.getIndustryData(industry);
    let {realEstateFactor: re_coeff, hardwareFactor: hw_coeff, robotFactor: robo_coeff, aiCoreFactor: ai_coeff} = data;
    [re_coeff, hw_coeff, robo_coeff, ai_coeff] = [re_coeff, hw_coeff, robo_coeff, ai_coeff].map((x) => x ?? 0);

    const boosters: readonly { name:string, size:number, coeff: number }[]= [{
      name: 'Real Estate',
      size: re_size,
      coeff: re_coeff,
    }, {
      name: 'Hardware',
      size: hw_size,
      coeff: hw_coeff,
    }, {
      name: 'Robots',
      size: robo_size,
      coeff: robo_coeff,
    }, {
      name: 'AI Cores',
      size: ai_size,
      coeff: ai_coeff,
    }];
    const booster_sum_size = boosters.reduce((acc, d) => acc + d.size, 0);
    const booster_sum_coeff = boosters.reduce((acc, d) => acc + d.coeff, 0);

    // FIXME: Assumes all warehouses have the same available boost space and take the same solution.
    // warehouses may have different sizes, and as offices have different office multipliers, they may make
    // different amounts of storage available as boosts space.
    // This is still "close enough" for now, especially with Smart Storage handling any discrepancies.
    const calc_boost_mult = (inventory: BoostSolution) => {
      const result = 6 * (
        (1 + 0.002 * inventory['Real Estate'])**re_coeff *
        (1 + 0.002 * inventory['Hardware'])**hw_coeff *
        (1 + 0.002 * inventory['Robots'])**robo_coeff *
        (1 + 0.002 * inventory['AI Cores'])**ai_coeff
      ) ** 0.73;
      return result;
    };

    /**
     * Given the available space, return the optimal solution and maximised boost multiplier.
     *
     * Note that this optimizes for maximum boost multiplier per space. This is not necessarily the solution which
     * maximises profit, given that AI Cores have a secondary catalytic effect which boosts quality.
     */
    // TODO: Come up with something which does optimise for profit. Eventually. The supply chain gets very complicated
    // once exports are involved, but quality tends to have compounding returns so would only become more important.
    // This heuristic is very inexpensive to calculate, and is a good starting point. It may be that a full solution
    // would be too expensive to calculate in real time.
    return (available_space: number): [BoostSolution, number] => {
      let sum_size = booster_sum_size;
      let sum_coeff = booster_sum_coeff;
      const terms = boosters.slice();
      do {
        // Multiplier effect is proportional to:
        //  (1+0.002*re_count)**re_coeff * (1+0.002*hw_count)**hw_coeff * (1+0.002*robo_count)**robo_coeff * (1+0.002*ai_count)**ai_coeff
        const result_entries = terms.map(d =>
          [d.name, Math.floor(
            (
              d.coeff * available_space -
              500 * (d.size * (sum_coeff - d.coeff) - d.coeff * (sum_size - d.size))
            ) / (sum_coeff * d.size)
          )] satisfies [string, number]
        );
        const idx = result_entries.findIndex(([name, amount]) => amount <= 0);
        if (idx >= 0) {
          // If we get a negative result for any term, remove it and restart
          const excluded_term = terms.splice(idx, 1)[0];
          sum_size -= excluded_term.size;
          sum_coeff -= excluded_term.coeff;
          continue;
        }
        const result = Object.assign({}, empty_boost_solution, Object.fromEntries(result_entries));
        return [
          result,
          calc_boost_mult(result),
        ];
        // eslint-disable-next-line no-constant-condition
      } while (true);
    };
  };

  const storage_used = (inventory: BoostSolution) => {
    return re_size * inventory['Real Estate'] +
      hw_size * inventory['Hardware'] +
      robo_size * inventory['Robots'] +
      ai_size * inventory['AI Cores'];
  };

  // Track state for debugging purposes
  const expected_multiplier = new Map<string, number[]>();


  /**
   * Import cache and helpers
   */
  // Import division, import city, material -> export present
  const active_imports = new Map<string, boolean>();

  const import_cache_string = (division: string, city: CityName, material: CorpMaterialName) => `${division}:${city}:${material}`;

  const is_importing = (division: string, city: CityName, material: CorpMaterialName) => {
    return active_imports.has(import_cache_string(division, city, material));
  };

  const update_import_cache = () => {
    active_imports.clear();
    // For every division we have...
    for (const export_division_name of ns.corporation.getCorporation().divisions) {
      const export_division = ns.corporation.getDivision(export_division_name);
      const outputs = ns.corporation.getIndustryData(export_division.type).producedMaterials;
      // provided we make output materials
      if (!outputs) {
        continue;
      }
      // examine each city it operates in
      for (const export_city of export_division.cities) {
        // and the list of export orders for every output material produced here
        for (const output of outputs) {
          const material_data = ns.corporation.getMaterial(export_division_name, export_city, output);
          // If we're sending material, cache this for the division and city it's being imported to
          for (const export_order of material_data.exports) {
            active_imports.set(import_cache_string(export_order.division, export_order.city, output), true);
          }
        }
      }
    }
  };

  /**
   * Main division handling.
   *
   * Returns a handler which sets near-optimal I/O amounts for all materials.
   */
  const io_optimizer = (industry: CorpIndustryName, boost_solver: (available_space: number) => [BoostSolution, number]) => {
    const industry_data: CorpIndustryData = ns.corporation.getIndustryData(industry);

    // Inputs per production unit
    const inputs = industry_data.requiredMaterials;

    if (!industry_data.makesMaterials) {
      console.warn('Non-materials industries not implemented yet');
      const relevant_materials = new Set<CorpMaterialName>([...Object.keys(inputs) as CorpMaterialName[], ...Object.keys(empty_boost_solution) as CorpMaterialName[]]);
      const ret =  (city: CityName) => {
        const division = industry;
        // Do nothing in head city
        // TODO: Implement
        if (city === head_city) {
          return;
        }
        // In support cities, use all available storage to maximise the boost multiplier
        const warehouse = ns.corporation.getWarehouse(division, city);
        const [boost_solution, boost_mult] = boost_solver(warehouse.size);
        for (const material of relevant_materials) {
          const desired =
          // Boost materials only
          (Object.hasOwn(boost_solution, material) ? boost_solution[material as BoostMaterial] : 0);
          const data: Material = ns.corporation.getMaterial(division, city, material);
          const current = data.stored;
          set_buysell_material(division, city, material, (desired - current) / seconds_per_cycle);
        }
      };
      ret.division = industry;
      return ret;
    }
    // Outputs per production unit
    const outputs = industry_data.producedMaterials;
    if (!outputs) {
      panic(ns, 'Material making industry has undefined producedMaterials!?');
    }

    const relevant_materials = new Set<CorpMaterialName>([...Object.keys(inputs) as CorpMaterialName[], ...outputs, ...Object.keys(empty_boost_solution) as CorpMaterialName[]]);

    // Determine how much storage space changes per production unit
    const input_storage_per_unit = Object.entries(inputs).reduce((acc, [name, amount]) =>
      acc + storage_per_material[name] * amount,
      0
    );
    // XXX: Are outputs always one unit per production?
    const output_storage_per_unit = outputs.reduce((acc, name) =>
      acc + storage_per_material[name],
      0
    );

    // If an output hasn't been moving for a while, it's clogged, and needs to be dumped.
    const clogged_tracker = new Map<CorpMaterialName, Map<CityName, [number, number]>>(outputs.map(name => [name, new Map<CityName, [number, number]>(Object.values(ns.enums.CityName).map((city) =>
      [city, [0, 0]] satisfies [CityName, [number, number]]
    ))]));

    const check_clog = (material_data: Material, city: CityName) => {
      const clogged_entry = clogged_tracker.get(material_data.name);
      // If it's not an output we're tracking, ignore it
      if (clogged_entry === undefined) {
        return false;
      }
      const [clogged_count, last_max] = clogged_entry.get(city) ?? [0, 0];
      const { desiredSellAmount: desired_sell_raw } = material_data;
      const desired_sell = eval?.(String(desired_sell_raw)
        .replace(/MAX/g, String(last_max / 10))
        .replace(/PROD/g, String(material_data.productionAmount))
        .replace(/INV/g, String(last_max))
      );
      const current_max = material_data.stored;
      // This script always uses numbers in this space; if the user did something different, ignore it this cycle
      if (typeof desired_sell !== 'number') {
        return false;
      }
      const maybe_clogged = material_data.actualSellAmount < desired_sell * 0.8;
      // If not clogged, we're fine
      if (!maybe_clogged) {
        clogged_entry.set(city, [0, current_max]);
        return false;
      }
      if (clogged_count >= 5) {
        // Clogged for five cycles; warn user and dump it all
        console.warn(`Material ${material_data.name} in ${industry}@${city} has been clogged for five cycles; dumping all`);
        ns.corporation.sellMaterial(industry, city, material_data.name, 'MAX', '0');
        clogged_entry.set(city, [clogged_count, current_max]);
        return true;
      }
      clogged_entry.set(city, [clogged_count + 1, current_max]);
      return false;
    };

    const optimize_io = (city: CityName) => {
      const division = industry;
      const office = ns.corporation.getOffice(division_name, city);
      // These three factors are fixed
      const office_mult = calculate_office_production(office);
      const upgrade_mult = 1 + .03 ** ns.corporation.getUpgradeLevel('Smart Factories');
      let research_mult = 1;
      if (ns.corporation.hasResearched(division, 'Drones - Assembly')) {
        research_mult *= 1.2;
      }
      if (ns.corporation.hasResearched(division, 'Self-Correcting Assemblers')) {
        research_mult *= 1.1;
      }
      const const_mult = office_mult * upgrade_mult * research_mult;
      // However the boost multiplier changes based on how much we allocate to "boost" material
      // We could find an exact solution, or we could be lazy and binary search over the implicit search space
      const warehouse = ns.corporation.getWarehouse(division, city);
      const total_storage = warehouse.size;

      // Dynamic: We export materials before the sell phase, which means warehouses receiving imports needs to reserve
      // enough space to have all of their imported inputs and all of their outputs at once.
      // Exports are set dynamically, so we can't precache this the way we could inputs and outputs.
      const import_storage_per_unit = (Object.entries(inputs) as [CorpMaterialName, number][]).reduce((acc, [name, amount]) =>
        acc + (is_importing(division, city, name) ? acc + storage_per_material[name] * amount : 0),
        0
      );

      // We split the binary search index search space into two, so that we can handle extreme lategame production
      // ratios:
      // 0:        Exactly 0 space allocated to boost materials (this should always be feasible)
      // 1..201:   Exponential scale: 1.8**(n-202) percentage points of storage allocated to boost material
      //   - At 201, we have 1.8**-1   = 0.555555% of storage allocated to boost material.
      //   - At 190, we have 1.8**-11  = 0.00155%.
      //   - At   1, we have 1.8**-201 = 4.90034e-52%.
      // 202..400: Linear scale:      Percentage points from 1-100% of storage allocated to boost material
      //   - At 400, we allocate 100% to boost material (this should always be infeasible)
      //   - At 300, we allocate 50% to boost material
      //   - At 202, we allocate 1% to boost material
      const index_to_ratio = (index: number) => index >= 202
        ? (index - 200) / 200
        : index === 0
          ? 0
          : 1.8 ** (index-202) / 100;

      const bsearch_result = binary_search((x: number) => {
        // Determine what storage is allocated to storage and what storage is allocated to active production
        const boost_storage = Math.floor(index_to_ratio(x) * total_storage);
        const active_storage = total_storage - boost_storage;
        // Solve for maximum boost multiplier for the given boost storage allocation
        const [boost_solution, boost_mult] = boost_solver(boost_storage);

        // Overall production multiplier
        const production_multiplier = const_mult * boost_mult;

        // Production per full cycle
        const production_per_cycle = production_multiplier * seconds_per_cycle;

        const input_storage = production_per_cycle * (input_storage_per_unit + import_storage_per_unit);
        const output_storage = production_per_cycle * (output_storage_per_unit + import_storage_per_unit);

        const active_storage_required = Math.max(input_storage, output_storage);

        if (active_storage < active_storage_required) {
          // Constraint violation
          return 1;
        }

        if (storage_used(boost_solution) > boost_storage) {
          panic(ns, 'boost_solver returned a solution that used more storage than allocated!?');
        }

        // Maximise viable production multiplier (result closest to 0)
        return -1/production_multiplier;
      }, 0, 0, 400);
      if (bsearch_result >= 0) {
        panic(ns, 'storage_assigner binary search found an exact solution!?');
      }
      if (bsearch_result === -1) {
        // bsearch would have us "insert" before the 0% candiate; that is, even allocating no storage to boost material
        // is infeasible for full production.
        // We need to remove all boost material, and cap the amount of production to levels which can be supported.
        const active_storage = total_storage;
        // boost_mult is 1 with no boost material
        const production_multiplier = const_mult;

        // Theoretical production capacity with no storage constraints
        const uncapped_production_per_cycle = production_multiplier * seconds_per_cycle;


        const uncapped_input_storage = uncapped_production_per_cycle * input_storage_per_unit;
        const uncapped_output_storage = uncapped_production_per_cycle * output_storage_per_unit;
        const uncapped_active_storage = Math.max(uncapped_input_storage, uncapped_output_storage);

        const capping_multiplier = active_storage / uncapped_active_storage;

        const production_per_cycle = capping_multiplier * uncapped_production_per_cycle;

        // Sell everything, less what is needed for a production cycle
        for (const material of ns.corporation.getConstants().materialNames) {
          const desired = (inputs[material] ?? 0) * production_per_cycle;
          const data: Material = ns.corporation.getMaterial(division, city, material);
          const current = data.stored;
          if (!check_clog(data, city)) {
            set_buysell_material(division, city, material, (desired - current) / seconds_per_cycle);
          }
        }
        expected_multiplier.get(division)!.push(1);
        return;
      }
      // We want the solution before the insertion point, as the insertion point is the first infeasible solution
      const boost_storage_ratio_index = -bsearch_result - 2;
      // Determine what storage is allocated to storage and what storage is allocated to active production
      const boost_storage = Math.floor(index_to_ratio(boost_storage_ratio_index) * total_storage);
      // Solve for maximum boost multiplier for the given boost storage allocation
      const [boost_solution, boost_mult] = boost_solver(boost_storage);

      // Overall production multiplier
      const production_multiplier = const_mult * boost_mult;
      const production_per_cycle = production_multiplier * seconds_per_cycle;

      // Buy what is necessary to reach our ideal boost numbers plus what is required for production
      for (const material of relevant_materials) {
        const desired =
          // Boost materials
          (Object.hasOwn(boost_solution, material) ? boost_solution[material as BoostMaterial] : 0) +
          // Input materials
          (inputs[material] ?? 0) * production_per_cycle;
        const data: Material = ns.corporation.getMaterial(division, city, material);
        const current = data.stored;
        if (!check_clog(data, city)) {
          set_buysell_material(division, city, material, (desired - current) / seconds_per_cycle);
        }
      }
      expected_multiplier.get(division)!.push(boost_mult);
    };
    optimize_io.division = industry;
    return optimize_io;
  };

  const calculate_office_production = (office: Office) => {
    const ops_prod = office.employeeProductionByJob.Operations;
    const eng_prod = office.employeeProductionByJob.Engineer;
    const mgt_prod = office.employeeProductionByJob.Management;
    const sum_prod = ops_prod + eng_prod + mgt_prod;
    const mgt_factor = 1 + mgt_prod / (1.2*sum_prod);
    const employee_factor = (ops_prod ** 0.4 + eng_prod ** 0.3) * mgt_factor;
    return 0.05 * employee_factor;
  };

  const division_ios = new Map<string, {(city: CityName): void, division: string}>();

  // Mean exponential average profit and funds
  let mea_profit = 0;
  let mea_funds = 0;

  /**
   * Main loop
   */
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
      case 'EXPORT': {
        const divisions = ns.corporation.getCorporation().divisions;
        for (const division of divisions as CorpIndustryName[]) {
          // If we don't have a division tracked yet, add it
          if (!division_ios.has(division)) {
            if (!ensure_sane_division(division)) {
              continue;
            }
            ns.tprint(`Setting up I/O for ${division} (sanity ensured)`);
            add_sanitized_division(division);
            division_ios.set(division, io_optimizer(division, boost_optimizer(division)));
          } else {
            division_maintenance(division);
          }
        }
        // If we're at a later stage of the game (steady revenue) start working on the upgrade feedback loop
        const corp = ns.corporation.getCorporation();
        // Threshold here: 100M
        // Make sure this isn't a fluke/one-off excess dumping cycle by tracking revenue via moving exponential average
        const profit_this_cycle = corp.revenue - corp.expenses;
        mea_profit = 0.95 * mea_profit + 0.05 * profit_this_cycle;
        mea_funds = 0.95 * mea_funds + 0.05 * corp.funds;
        if (corp.revenue - corp.expenses > 1e8) {
          // Top priority: If we can upgrade Wilsons, do so, repeatedly
          while (ns.corporation.getCorporation().funds > ns.corporation.getUpgradeLevelCost('Wilson Analytics')) {
            ns.corporation.levelUpgrade('Wilson Analytics');
          }
          // Then check in on our key industry. If it's present and not designing new products, start this process
          if (corp.divisions.includes(key_sink_industry)) {
            const division = ns.corporation.getDivision(key_sink_industry);
            const max_products = 3 +
             (ns.corporation.hasResearched(key_sink_industry, 'uPgrade: Capacity.II')
              ? 2
              : ns.corporation.hasResearched(key_sink_industry, 'uPgrade: Capacity.I')
                ? 1
                : 0);
            const products = division.products.map(d => [d, parseInt(d.slice(Math.max(d.lastIndexOf('-') + 1, 0))), ns.corporation.getProduct(key_sink_industry, head_city, d)] satisfies [string, number, Product]);
            const is_making_product = products.some(([name, id, data]) => data.developmentProgress < 100);
            if (!is_making_product) {
              let investment_minimum = 0;
              let to_discontinue;
              // Discontinue oldest product if we're full
              if (division.products.length === max_products) {
                const oldest_id = Math.min(...products.map(d => d[1]));
                const oldest_product = products.find(d => d[1] === oldest_id);
                if (!oldest_product) {
                  panic(ns, `Failed to find oldest product in ${key_sink_industry}@${head_city} despite being full!?`);
                }
                investment_minimum = oldest_product[2].designInvestment + oldest_product[2].advertisingInvestment;
                to_discontinue = oldest_product[0];
              }
              // Try to create an new product, using 2% of our funds
              const investment = 0.02 * mea_funds;
              const newest_id = Math.max(0, ...products.map(d => d[1]));
              if (investment >= investment_minimum && ns.corporation.getCorporation().funds >= investment) {
                if (to_discontinue) {
                  ns.corporation.discontinueProduct(key_sink_industry, to_discontinue);
                }
                const new_product_name = `${key_sink_industry}-${format_currency(investment / 2, { colorize: false })}-${newest_id + 1}`;
                ns.corporation.makeProduct(key_sink_industry, head_city, new_product_name, investment / 2, investment / 2);
              }
            }
          }
          // Then repeatedly buy other upgrades, if they're cheap enough relative to our current funds
          for (const [threshold, upgrades] of [
            // If we can improve the stats of our employees using less than 20% of our funds, do so
            [0.2, ['Nuoptimal Nootropic Injector Implants', 'Speech Processor Implants', 'Neural Accelerators', 'FocusWires', 'ABC SalesBots']],
            // If we can improve production factors using less than 10% of our funds, do so
            [0.1, ['Smart Factories', 'Smart Storage', 'Project Insight']],
          ] satisfies [number, string[]][]) {
            const upgrade_costs = new PriorityQueue<[string, number]>((l, r) => l[1] - r [1]);
            upgrade_costs.heapify(...upgrades.map(d => [d, ns.corporation.getUpgradeLevelCost(d)] satisfies [string, number]));
            do {
              const entry = upgrade_costs.pop();
              if (!entry) {
                break;
              }
              const [upgrade, cost] = entry;
              if (cost > threshold * ns.corporation.getCorporation().funds) {
                break;
              }
              ns.corporation.levelUpgrade(upgrade);
              upgrade_costs.push([upgrade, ns.corporation.getUpgradeLevelCost(upgrade)]);
            // eslint-disable-next-line no-constant-condition
            } while (true);
          }
          const upgrade_office_size = (division: CorpIndustryName, city: CityName | `${CityName}`) => {
            ns.corporation.upgradeOfficeSize(division, city, 1);
            // Hire any employees to match
            let office = ns.corporation.getOffice(division, city);
            while (office.numEmployees < office.size) {
              const last_size = office.numEmployees;
              ns.corporation.hireEmployee(division, city);
              office = ns.corporation.getOffice(division, city);
              if (office.numEmployees === last_size) {
                break;
              }
            }
          };
          // Auto buy advertisements, upgrade offices (hiring staff along the way) and warehouses
          // We liberally buy upgrades based on distance from the key sink of our supply chain, precomputed at the top
          // of the file. Industries not part of the supply chain ("dummy" divisions) are ignored.
          const ranked_divisions = new PriorityQueue<[CorpIndustryName, number]>((l, r) => l[1] - r[1]);
          ranked_divisions.heapify(...sanitized_divisions.values().map(d => [d, industry_rank.get(d)] satisfies [CorpIndustryName, number?]).filter(d => d[1] !== undefined) as IteratorObject<[CorpIndustryName, number]>);
          do {
            const entry = ranked_divisions.pop();
            if (!entry) {
              break;
            }
            const [division, rank] = entry;
            const coeff = 0.68 ** rank;
            // Helper: use either the nominal amount of funds available this cycle, or the current corporate funds,
            // whichever is lower. If uniform is specified, also checks that we have enough current funds to cover this
            // the specified number of times.
            const funds = (cycle_nominal_ratio: number, uniform=1) => Math.min(cycle_nominal_ratio * coeff * mea_funds, ns.corporation.getCorporation().funds / uniform);
            const division_data = ns.corporation.getDivision(division);
            const industry_data = ns.corporation.getIndustryData(division);
            const is_product_kind = !industry_data.makesMaterials;

            const uniform_cities = division_data.cities.slice();

            if (is_product_kind) {
              division_data.cities.splice(division_data.cities.findIndex(d => d === head_city), 1);

              // Aggressively increase the size of head office (10%)
              while (ns.corporation.getOfficeSizeUpgradeCost(division, head_city, 1) < funds(0.1)) {
                upgrade_office_size(division, head_city);
              }

              // Aggressively buy marketing: (15%)
              while (ns.corporation.getHireAdVertCost(division) < funds(0.15)) {
                ns.corporation.hireAdVert(division);
              }
              // Don't really bother with head office warehouse upgrades while we don't buy boost materials in it, but
              // we'll take them if they're very cheap to avoid capping production (0.02%)
              while (ns.corporation.getUpgradeWarehouseCost(division, head_city, 1) < funds(0.0002)) {
                ns.corporation.upgradeWarehouse(division, head_city, 1);
              }
            } else {
              // Buy marketing normally (3%)
              while (ns.corporation.getHireAdVertCost(division) < funds(0.03)) {
                ns.corporation.hireAdVert(division);
              }
            }

            // Upgrade all offices to the same size (1%)
            for (const [idx, city] of uniform_cities.entries()) {
              while (ns.corporation.getOfficeSizeUpgradeCost(division, city, 1) < funds(0.01, uniform_cities.length - idx)) {
                upgrade_office_size(division, city);
              }
            }

            // Upgrade all warehouses to the same size (1%)
            for (const [idx, city] of uniform_cities.entries()) {
              while (ns.corporation.getUpgradeWarehouseCost(division, city, 1) < funds(0.01, uniform_cities.length - idx)) {
                ns.corporation.upgradeWarehouse(division, city, 1);
              }
            }
          // eslint-disable-next-line no-constant-condition
          } while (true);
        }
        update_import_cache();
        // The trick for I/O handling is to do everything after a cycle's production is complete, and divisons have
        // taken any exports.
        // We sell everything we don't need to retain as a catalyst for boost multiplication or for production.
        // We also set what we want to buy at this point.
        // Note, Employees will gain experience and adjust production slight after the START phase, so actual
        // production in the next cycle can differ slightly. Early game, we don't worry about it.
        // Later, we let Smart Supply handle any variation.
        for (const division_io of division_ios.values()) {
          const arr = [] satisfies number[];
          expected_multiplier.set(division_io.division, arr);
          for (const city of Object.values(ns.enums.CityName)) {
            division_io(city);
          }
          // console.log(`Expected ${division_io.division} multipliers: [${arr.join(', ')}], avg: x${arr.reduce((acc, d) => acc + d, 0) / arr.length}, last cycle: x${ns.corporation.getDivision(division_io.division).productionMult}`);
        }
        break;
      } case 'SALE': {
        // Examine all divisions, including unsanitized ones.
        const divisions = ns.corporation.getCorporation().divisions;
        for (const division of divisions as CorpIndustryName[]) {
          // Examine all offices.
          for (const city of ns.corporation.getDivision(division).cities) {
            const office = ns.corporation.getOffice(division, city);
            // If the average morale is low, throw a party.
            if (office.avgMorale < office.maxMorale / 1.01) {
              // 1M per employee boosts morale by ~1%
              ns.corporation.throwParty(division, city, 1e6);
            }
            // If the average energy is low, buy tea.
            if (office.avgEnergy < office.maxEnergy - 0.5) {
              ns.corporation.buyTea(division, city);
            }
          }
        }
        break;
      }
    }
  }
}
