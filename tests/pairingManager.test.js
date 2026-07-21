import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  updateVariationMarkers,
  duplicatePairing,
  getOpenSlotPairings,
  isComplete,
} from '../hr-color-predictor/sidebar/components/pairingManager.js';
import { pairing, horse } from './fixtures.js';

test('updateVariationMarkers: a horse can express only one variation', () => {
  let p = pairing({ dam: horse() });
  p = updateVariationMarkers(p, 'dam', { peacock: 'expresses' });
  assert.equal(p.dam.variationMarkers.peacock, 'expresses');

  p = updateVariationMarkers(p, 'dam', { varnishedBlanket: 'expresses' });
  assert.equal(p.dam.variationMarkers.peacock, 'line');          // auto-downgraded
  assert.equal(p.dam.variationMarkers.varnishedBlanket, 'expresses');
});

test('updateVariationMarkers: both can be "in their line"', () => {
  let p = pairing({ dam: horse() });
  p = updateVariationMarkers(p, 'dam', { peacock: 'line' });
  p = updateVariationMarkers(p, 'dam', { varnishedBlanket: 'line' });
  assert.equal(p.dam.variationMarkers.peacock, 'line');
  assert.equal(p.dam.variationMarkers.varnishedBlanket, 'line');
});

test('updateVariationMarkers: no-op on an empty slot', () => {
  const p = pairing({ dam: null });
  assert.equal(updateVariationMarkers(p, 'dam', { peacock: 'expresses' }).dam, null);
});

test('duplicatePairing: new id and incrementing copy suffix', () => {
  const p  = pairing({ id: 'x', name: 'Test', dam: horse() });
  const c1 = duplicatePairing(p, [p]);
  assert.notEqual(c1.id, p.id);
  assert.equal(c1.name, 'Test (copy)');
  const c2 = duplicatePairing(p, [p, c1]);
  assert.equal(c2.name, 'Test (copy 2)');
});

test('duplicatePairing: deep-clones so the original is untouched', () => {
  const p = pairing({ dam: horse({ name: 'Foo' }) });
  const c = duplicatePairing(p, [p]);
  c.dam.name = 'Bar';
  assert.equal(p.dam.name, 'Foo');
});

test('getOpenSlotPairings: open slot AND matching breed', () => {
  const openSameBreed = pairing({ id: 'a', dam: horse({ breed: 'Appaloosa Horse' }), sire: null });
  const fullPairing   = pairing({ id: 'b', dam: horse(), sire: horse() });
  const open = getOpenSlotPairings([openSameBreed, fullPairing], 'Appaloosa Horse', 'sire');
  assert.deepEqual(open.map(p => p.id), ['a']);
});

test('isComplete', () => {
  assert.equal(isComplete(pairing({ dam: horse(), sire: horse() })), true);
  assert.equal(isComplete(pairing({ dam: horse(), sire: null })), false);
});
