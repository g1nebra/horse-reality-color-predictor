import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGenotype } from '../hr-color-predictor/engine/genotypeParser.js';
import { row } from './fixtures.js';

test('unknown breed passes every tested row through', () => {
  const { genotype } = parseGenotype([row('Extension', 'E / e'), row('Grey', 'G / n')], 'Nonexistent Breed');
  assert.deepEqual(genotype.E, ['E', 'e']);
  assert.deepEqual(genotype.G, ['G', 'n']);
});

test('untested rows (? / ?) are skipped', () => {
  const { genotype } = parseGenotype([row('Extension', 'E / e'), row('Agouti', '? / ?')], 'Nonexistent Breed');
  assert.ok('E' in genotype);
  assert.ok(!('A' in genotype));
});

test('loci the breed does not have are dropped', () => {
  // Friesian Horse has no Grey (G is in its `none` list).
  const { genotype } = parseGenotype([row('Extension', 'E / e'), row('Grey', 'G / n')], 'Friesian Horse');
  assert.ok('E' in genotype);
  assert.ok(!('G' in genotype));
});

test('fixed-locus stubs are pre-filled', () => {
  // Friesian is fixed a/a on Agouti and never shows the row.
  const { genotype } = parseGenotype([], 'Friesian Horse');
  assert.deepEqual(genotype.A, ['a', 'a']);
});

test('hidden modifier defaults are applied for the breed', () => {
  const { genotype } = parseGenotype([], 'Appaloosa Horse');
  assert.deepEqual(genotype.f,     ['F', 'F']); // Flaxen default
  assert.deepEqual(genotype.STY,   ['n', 'n']); // Sooty default
  assert.deepEqual(genotype.PATN2, ['n', 'n']); // hidden white default
});

test('hidden gene toggles override the parsed/default value', () => {
  const { genotype } = parseGenotype([row('Agouti', 'A / A')], 'Akhal-Teke', { A: ['A+', 'a'] });
  assert.deepEqual(genotype.A, ['A+', 'a']);
});

test('the bundled KIT row passes when the breed has a KIT-family gene', () => {
  const { genotype } = parseGenotype([row('KIT', 'TO / n')], 'Icelandic Horse');
  assert.deepEqual(genotype.KIT, ['TO', 'n']);
});
