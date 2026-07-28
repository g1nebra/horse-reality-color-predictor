import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFolder,
  renameFolder,
  deleteFolder,
  assignPairingsToFolder,
  groupPairingsByFolder,
} from '../hr-color-predictor/sidebar/components/pairingManager.js';
import { pairing } from './fixtures.js';

test('createFolder adds a folder with an id and trimmed name', () => {
  const f = createFolder([], '  Appaloosas ');
  assert.equal(f.length, 1);
  assert.equal(f[0].name, 'Appaloosas');
  assert.ok(typeof f[0].id === 'string' && f[0].id.length > 0);
});

test('createFolder falls back to a default name when blank', () => {
  const f = createFolder([{ id: 'a', name: 'x' }], '   ');
  assert.equal(f[1].name, 'Folder 2');
});

test('renameFolder updates the target and ignores blank names', () => {
  const folders = [{ id: 'a', name: 'Old' }];
  assert.equal(renameFolder(folders, 'a', 'New')[0].name, 'New');
  assert.equal(renameFolder(folders, 'a', '   ')[0].name, 'Old');
});

test('folder names are capped at 30 characters', () => {
  const long = 'x'.repeat(50);
  assert.equal(createFolder([], long)[0].name.length, 30);
  assert.equal(renameFolder([{ id: 'a', name: 'A' }], 'a', long)[0].name.length, 30);
});

test('deleteFolder removes only the target folder', () => {
  const folders = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  assert.deepEqual(deleteFolder(folders, 'a').map(f => f.id), ['b']);
});

test('assignPairingsToFolder sets folderId (and null unassigns)', () => {
  const list = [pairing({ id: 'p1' }), pairing({ id: 'p2' }), pairing({ id: 'p3' })];
  const moved = assignPairingsToFolder(list, ['p1', 'p3'], 'f1');
  assert.equal(moved.find(p => p.id === 'p1').folderId, 'f1');
  assert.equal(moved.find(p => p.id === 'p2').folderId, undefined);
  assert.equal(moved.find(p => p.id === 'p3').folderId, 'f1');
  const unassigned = assignPairingsToFolder(moved, ['p1'], null);
  assert.equal(unassigned.find(p => p.id === 'p1').folderId, null);
});

test('groupPairingsByFolder puts pairings in folders then an Unassigned section', () => {
  const folders = [{ id: 'f1', name: 'A' }, { id: 'f2', name: 'B' }];
  const list = [
    pairing({ id: 'p1', folderId: 'f1' }),
    pairing({ id: 'p2' }),               // no folderId -> unassigned
    pairing({ id: 'p3', folderId: 'gone' }), // dangling -> unassigned
  ];
  const sections = groupPairingsByFolder(list, folders);
  assert.deepEqual(sections.map(s => s.name), ['A', 'B', 'Unassigned']);
  assert.deepEqual(sections[0].pairings.map(p => p.id), ['p1']);
  assert.deepEqual(sections[1].pairings.map(p => p.id), []);
  assert.equal(sections[2].folderId, null);
  assert.deepEqual(sections[2].pairings.map(p => p.id).sort(), ['p2', 'p3']);
});
