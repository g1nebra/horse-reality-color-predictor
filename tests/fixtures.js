// Shared test fixtures / builders. Not a test file (no *.test.js suffix), so the
// runner imports it but never executes it as a suite.

// DOM genetics row as content.js serialises it, for parseGenotype.
export function row(name, result, tested = [true, true]) {
  return { name, result, tested };
}

// A minimal horse object (shape from sidebar.js handlePickHorse).
export function horse(overrides = {}) {
  return {
    name:              'Test',
    breed:             'Appaloosa Horse',
    url:               '',
    rows:              [],
    genotype:          {},
    tested:            {},
    partiallyTested:   false,
    hiddenGeneToggles: {},
    variationMarkers:  {},
    ...overrides,
  };
}

// A pairing object (shape from pairingManager.js).
export function pairing(overrides = {}) {
  return { id: 'p1', name: 'Pairing 1', dam: null, sire: null, ...overrides };
}
