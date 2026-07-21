// Pre-release smoke test. Drives the full pipeline (parse -> offspring -> resolve)
// on a few representative cases and checks invariants. Run: node tests/smoke.mjs
// Exits non-zero if anything fails.

import { parseGenotype }      from '../hr-color-predictor/engine/genotypeParser.js';
import { calculateOffspring } from '../hr-color-predictor/engine/punnettEngine.js';
import { resolvePhenotype }   from '../hr-color-predictor/engine/phenotypeResolver.js';

let pass = 0;
const failures = [];
const check = (name, ok) => { if (ok) pass++; else failures.push(name); };
const row = (name, result, tested = [true, true]) => ({ name, result, tested });

// Case 1: two Leopard-capable Appaloosas.
{
  const breed = 'Appaloosa Horse';
  const rows = [
    row('Extension', 'E / e'), row('Agouti', 'A / a'),
    row('Appaloosa', 'LP / lp'), row('PATN1', 'PATN1 / patn1'),
  ];
  const dam  = parseGenotype(rows, breed).genotype;
  const sire = parseGenotype(rows, breed).genotype;
  const out  = calculateOffspring(dam, sire);

  check('appaloosa: probabilities sum to 1', Math.abs(out.reduce((s, o) => s + o.probability, 0) - 1) < 1e-9);

  let threw = false, everyHasBase = true, sawPeacock = false;
  for (const o of out) {
    try {
      const ph = resolvePhenotype(o.genotype, breed);
      if (typeof ph.base !== 'string') everyHasBase = false;
      if (ph.variations.includes('peacock')) sawPeacock = true;
    } catch { threw = true; }
  }
  check('appaloosa: resolvePhenotype never throws', !threw);
  check('appaloosa: every outcome has a base name', everyHasBase);
  check('appaloosa: peacock chance surfaces on Leopard outcomes', sawPeacock);
}

// Case 2: OLW carrier x OLW carrier produces some lethal outcomes.
{
  const g = { E: ['E', 'e'], A: ['A', 'a'], OLW: ['OLW', 'n'] };
  const out = calculateOffspring(g, g);
  check('OLW x OLW: at least one lethal outcome',
    out.some(o => resolvePhenotype(o.genotype, 'Quarter Horse').lethal));
}

// Case 3: Icelandic tobiano is eligible for necklace.
{
  const ph = resolvePhenotype({ E: ['E', 'e'], A: ['A', 'a'], KIT: ['TO', 'n'] }, 'Icelandic Horse');
  check('icelandic tobiano: necklace eligible', ph.variations.includes('necklace'));
}

console.log(`\nSmoke: ${pass} passed, ${failures.length} failed.`);
if (failures.length) {
  console.error('Failures:\n  ' + failures.join('\n  '));
  process.exit(1);
}
