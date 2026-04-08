// Takes two structured genotype objects (dam + sire) and computes every
// possible offspring genotype across all loci, with probability.

// Input  – dam, sire : { [locusKey]: [allele1, allele2] }
//          (output of genotypeParser.js, after hidden gene toggles merged)
// Output – array of { genotype, probability }
//    genotype: { [locusKey]: [allele1, allele2] } one possible offspring
//    probability: number - 0–1, summed across identical genotypes

//  Design notes:
//    - Only loci present in BOTH parents are crossed. A locus absent from one
//      parent is omitted from the offspring (untested data, not an error).
//    - Allele order within each pair is normalised (lower sort value first)
//      so that [A, a] and [a, A] are treated as the same genotype when summing.
//    - The engine is locus-agnostic: it does not apply dominance rules or
//     resolve phenotypes. That belongs in phenotypeResolver.js (v2).

// Internal helpers
/**
 * Cross one locus from both parents.
 * Returns the 4 Punnett square combinations, each at 0.25 probability.
 *
 * @param {[string, string]} damAlleles
 * @param {[string, string]} sireAlleles
 * @returns {Array<{ pair: [string, string], prob: number }>}
 */
function crossLocus(damAlleles, sireAlleles) {
  const [da1, da2] = damAlleles;
  const [sa1, sa2] = sireAlleles;
  return [
    { pair: normalise([da1, sa1]), prob: 0.25 },
    { pair: normalise([da1, sa2]), prob: 0.25 },
    { pair: normalise([da2, sa1]), prob: 0.25 },
    { pair: normalise([da2, sa2]), prob: 0.25 },
  ];
}

/**
 * Sort the two alleles into a canonical order so equivalent pairs merge.
 * Uses simple lexicographic sort, sufficient since we only need consistency,
 * not biological ordering (that's the resolver's job).
 *
 * @param {[string, string]} pair
 * @returns {[string, string]}
 */
function normalise(pair) {
  return [...pair].sort() ;
}

/**
 * Produce a stable string key for a full offspring genotype object,
 * used to detect and merge duplicate outcomes.
 *
 * @param {Object} genotype  { [locusKey]: [allele1, allele2] }
 * @returns {string}
 */
function genotypeKey(genotype) {
  return Object.keys(genotype)
    .sort()
    .map(locus => `${locus}:${genotype[locus].join('/')}`)
    .join('|');
}

// Main export

/**
 * @param {{ [locusKey]: [string, string] }} dam
 * @param {{ [locusKey]: [string, string] }} sire
 * @returns {Array<{ genotype: Object, probability: number }>}
 */
export function calculateOffspring(dam, sire) {
  // Find loci present in both parents
  const sharedLoci = Object.keys(dam).filter(locus => locus in sire);

  if (sharedLoci.length === 0) return [];

  // Build per-locus outcome arrays: [ [{pair, prob}, ...], [{pair, prob}, ...], ... ]
  const locusOutcomes = sharedLoci.map(locus =>
    crossLocus(dam[locus], sire[locus])
  );

  // Cartesian product across all loci to get every possible full genotype
  const combined = cartesian(locusOutcomes);

  // Build genotype objects and accumulate probabilities for identical outcomes
  const accumulator = new Map();

  for (const combination of combined) {
    // combination is an array of { pair, prob }, one per locus
    const genotype = {};
    let prob = 1;

    for (let i = 0; i < sharedLoci.length; i++) {
      genotype[sharedLoci[i]] = combination[i].pair;
      prob *= combination[i].prob;
    }

    const key = genotypeKey(genotype);
    if (accumulator.has(key)) {
      accumulator.get(key).probability += prob;
    } else {
      accumulator.set(key, { genotype, probability: prob });
    }
  }

  // Return sorted by probability descending
  return [...accumulator.values()].sort((a, b) => b.probability - a.probability);
}

// Cartesian product utility
// Turns [[a,b],[c,d]] into [[a,c],[a,d],[b,c],[b,d]]

/**
 * @param {Array<Array<any>>} arrays
 * @returns {Array<Array<any>>}
 */
function cartesian(arrays) {
  return arrays.reduce(
    (acc, curr) => acc.flatMap(combo => curr.map(item => [...combo, item])),
    [[]]
  );
}