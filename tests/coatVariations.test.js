import { test } from 'node:test';
import assert from 'node:assert/strict';
import coatVariations from '../hr-color-predictor/data/coatVariations.js';
import genesMapping   from '../hr-color-predictor/data/genesMapping.js';

// Patterns the resolver can actually produce, that a variation may require.
const KNOWN_PATTERNS = new Set(['Leopard', 'Blanket', 'Varnish', 'Tobiano']);
const INHERITANCE    = new Set(['random', 'inherited']);

test('every variation entry has valid required fields', () => {
  for (const [key, v] of Object.entries(coatVariations)) {
    assert.equal(typeof v.label, 'string', `${key}.label`);
    assert.equal(typeof v.short, 'string', `${key}.short`);
    assert.ok(Array.isArray(v.breeds) && v.breeds.length > 0, `${key}.breeds`);
    assert.ok(KNOWN_PATTERNS.has(v.requiresPattern), `${key}.requiresPattern = ${v.requiresPattern}`);
    assert.ok(INHERITANCE.has(v.inheritance), `${key}.inheritance = ${v.inheritance}`);
    assert.equal(typeof v.note, 'string', `${key}.note`);
  }
});

test('every breed referenced by a variation exists in genesMapping', () => {
  for (const [key, v] of Object.entries(coatVariations)) {
    for (const breed of v.breeds) {
      assert.ok(breed in genesMapping, `${key} references unknown breed "${breed}"`);
    }
  }
});
