import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOffspring } from '../hr-color-predictor/engine/punnettEngine.js';

const EPS = 1e-9;
const probOf = (out, locus, pair) =>
  out.filter(o => o.genotype[locus]?.join('/') === pair).reduce((s, o) => s + o.probability, 0);
const total = (out) => out.reduce((s, o) => s + o.probability, 0);

test('heterozygous x heterozygous gives the 1:2:1 ratio', () => {
  const out = calculateOffspring({ A: ['A', 'a'] }, { A: ['A', 'a'] });
  assert.ok(Math.abs(probOf(out, 'A', 'A/A') - 0.25) < EPS);
  assert.ok(Math.abs(probOf(out, 'A', 'A/a') - 0.5)  < EPS);
  assert.ok(Math.abs(probOf(out, 'A', 'a/a') - 0.25) < EPS);
  assert.ok(Math.abs(total(out) - 1) < EPS);
});

test('homozygous x homozygous gives a single certain outcome', () => {
  const out = calculateOffspring({ E: ['E', 'E'] }, { E: ['e', 'e'] });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].genotype.E, ['E', 'e']);
  assert.ok(Math.abs(out[0].probability - 1) < EPS);
});

test('only loci shared by both parents are crossed', () => {
  const out = calculateOffspring({ A: ['A', 'a'], E: ['E', 'e'] }, { A: ['A', 'a'] });
  assert.ok(out.every(o => 'A' in o.genotype));
  assert.ok(out.every(o => !('E' in o.genotype)));
});

test('no shared loci yields no outcomes', () => {
  assert.deepEqual(calculateOffspring({ A: ['A', 'a'] }, { E: ['E', 'e'] }), []);
});

test('probabilities sum to 1 across a multi-locus cross', () => {
  const g = { E: ['E', 'e'], A: ['A', 'a'], CR: ['CR', 'n'] };
  assert.ok(Math.abs(total(calculateOffspring(g, g)) - 1) < EPS);
});
