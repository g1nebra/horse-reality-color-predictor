import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhenotype } from '../hr-color-predictor/engine/phenotypeResolver.js';

const base = (g, breed = 'Quarter Horse') => resolvePhenotype(g, breed).base;

test('base colours from E + A', () => {
  assert.equal(base({ E: ['e', 'e'], A: ['a', 'a'] }),  'Chestnut');
  assert.equal(base({ E: ['E', 'e'], A: ['A', 'a'] }),  'Bay');
  assert.equal(base({ E: ['E', 'e'], A: ['A+', 'a'] }), 'Wild Bay');
  assert.equal(base({ E: ['E', 'e'], A: ['At', 'a'] }), 'Seal Brown');
  assert.equal(base({ E: ['E', 'e'], A: ['a', 'a'] }),  'Black');
});

test('unknown base when Extension is missing', () => {
  assert.equal(base({ A: ['A', 'a'] }), 'Unknown');
});

test('cream and pearl dilutions', () => {
  assert.equal(base({ E: ['e', 'e'], A: ['a', 'a'], CR: ['CR', 'n'] }),   'Palomino');
  assert.equal(base({ E: ['E', 'e'], A: ['A', 'a'], CR: ['CR', 'n'] }),   'Buckskin');
  assert.equal(base({ E: ['E', 'e'], A: ['a', 'a'], CR: ['CR', 'n'] }),   'Smoky Black');
  assert.equal(base({ E: ['e', 'e'], A: ['a', 'a'], CR: ['CR', 'CR'] }),  'Cremello');
  assert.equal(base({ E: ['e', 'e'], A: ['a', 'a'], CR: ['prl', 'prl'] }),'Pearl Chestnut');
});

test('grey overrides the base colour', () => {
  assert.equal(base({ E: ['E', 'e'], A: ['A', 'a'], G: ['G', 'n'] }), 'Grey');
});

test('lethal detection', () => {
  const lethal = (g) => resolvePhenotype(g, 'Quarter Horse').lethal;
  assert.equal(lethal({ E: ['E', 'e'], A: ['A', 'a'], OLW: ['OLW', 'OLW'] }), true);
  assert.equal(lethal({ E: ['E', 'e'], A: ['A', 'a'], KIT: ['W3', 'W3'] }),   true);
  assert.equal(lethal({ E: ['E', 'e'], A: ['A', 'a'], KIT: ['W20', 'W20'] }), false); // W20 viable
  assert.equal(lethal({ E: ['E', 'e'], A: ['A', 'a'], OLW: ['OLW', 'n'] }),   false);
});

test('Appaloosa pattern from LP / PATN dosage', () => {
  const p = (g) => resolvePhenotype({ E: ['E', 'e'], A: ['A', 'a'], ...g }, 'Appaloosa Horse').patterns;
  assert.deepEqual(p({ LP: ['LP', 'lp'], PATN1: ['PATN1', 'PATN1'] }), ['Leopard']);
  assert.deepEqual(p({ LP: ['LP', 'lp'], PATN1: ['PATN1', 'patn1'] }), ['Blanket']);
  assert.deepEqual(p({ LP: ['LP', 'LP'], PATN1: ['PATN1', 'PATN1'] }), ['Few-Spot Leopard']);
  assert.deepEqual(p({ LP: ['LP', 'lp'] }),                            ['Varnish']);
});

test('special coat variation eligibility (breed + pattern gated)', () => {
  const v = (g, breed = 'Appaloosa Horse') =>
    resolvePhenotype({ E: ['E', 'e'], A: ['A', 'a'], ...g }, breed).variations;

  assert.deepEqual(v({ LP: ['LP', 'lp'], PATN1: ['PATN1', 'PATN1'] }), ['peacock']);
  assert.deepEqual(v({ LP: ['LP', 'lp'], PATN2: ['PATN2', 'PATN2'] }), ['varnishedBlanket']); // PATN2 blanket
  assert.deepEqual(v({ LP: ['LP', 'lp'], PATN1: ['PATN1', 'patn1'] }), []);                   // PATN1 blanket -> none
  assert.deepEqual(v({ LP: ['LP', 'lp'] }),                            ['snowflake']);
  assert.deepEqual(v({ KIT: ['TO', 'n'] }, 'Icelandic Horse'),         ['necklace']);
  assert.deepEqual(v({ LP: ['LP', 'lp'], PATN1: ['PATN1', 'PATN1'] }, 'Knabstrupper'), []);   // not an Appaloosa variation
});

test('resolvePhenotype always returns the documented shape', () => {
  const r = resolvePhenotype({ E: ['E', 'e'], A: ['A', 'a'] }, 'Quarter Horse');
  for (const k of ['base', 'patterns', 'lethal', 'notes', 'variations']) {
    assert.ok(k in r, `missing key ${k}`);
  }
  assert.ok(Array.isArray(r.patterns) && Array.isArray(r.notes) && Array.isArray(r.variations));
});
