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
  const sharedLoci = Object.keys(dam).filter(locus => locus in sire);
  if (sharedLoci.length === 0) return [];

  // Fold locus-by-locus, deduplicating after each step.
  // Keeps the working set at ≤ 3^n distinct outcomes instead of the 4^n
  // raw Punnett combinations that the cartesian-first approach materialises.
  let partial = new Map([['', { genotype: {}, probability: 1 }]]);

  for (const locus of sharedLoci) {
    const pairs = crossLocus(dam[locus], sire[locus]);
    const next  = new Map();

    for (const { genotype, probability } of partial.values()) {
      for (const { pair, prob } of pairs) {
        const newGenotype = { ...genotype, [locus]: pair };
        const key         = genotypeKey(newGenotype);
        const newProb     = probability * prob;
        if (next.has(key)) {
          next.get(key).probability += newProb;
        } else {
          next.set(key, { genotype: newGenotype, probability: newProb });
        }
      }
    }

    partial = next;
  }

  return [...partial.values()].sort((a, b) => b.probability - a.probability);
}

// (cartesian helper removed calculateOffspring folds locus-by-locus now)