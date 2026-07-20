// Special coat variation catalogue, per the official HR documentation.
//
// Two kinds of inheritance:
//
//   'random'    Assigned purely by chance. The parents' coat variations do NOT
//               affect the foal and the variation cannot be inherited or bred
//               for. Rarity differs per variation.
//
//   'inherited' The chance depends on hidden, numeric genetics (similar to
//               genetic potential or conformation). Those values can be bred up
//               (or down) by breeding horses that show the variation, or that
//               have it in their family line. Horses that don't show it, or that
//               lack the right underlying colour/pattern, still carry the alleles
//               and can pass them on, so it can appear unexpectedly.
//
// Each entry:
//   label            user-facing name
//   short            compact name for badges in the narrow sidebar
//   breeds           breeds the variation occurs on
//   requiresPattern  resolved pattern the horse must already have for the
//                    variation to be visible (see phenotypeResolver)
//   inheritance      'random' | 'inherited'
//   note             short explanation surfaced in the results disclaimer

const INHERITED_NOTE =
  'Inheritable via hidden numeric genetics. Breed horses that show it, or have it '
  + 'in their family line, to raise the chance.';

export default {
  necklace: {
    label:           'Necklace Tobiano',
    short:           'Necklace',
    breeds:          ['Icelandic Horse'],
    requiresPattern: 'Tobiano',
    inheritance:     'inherited',
    note:            INHERITED_NOTE,
  },
  peacock: {
    label:           'Peacock Leopard',
    short:           'Peacock',
    breeds:          ['Appaloosa Horse'],
    requiresPattern: 'Leopard',
    inheritance:     'inherited',
    note:            INHERITED_NOTE,
  },
  varnishedBlanket: {
    label:           'Varnished Out Spotted Blanket',
    short:           'Varnished Blanket',
    breeds:          ['Appaloosa Horse'],
    requiresPattern: 'Blanket',
    inheritance:     'inherited',
    note:            INHERITED_NOTE,
  },
  snowflake: {
    label:           'Snowflake',
    short:           'Snowflake',
    breeds:          ['Appaloosa Horse'],
    requiresPattern: 'Varnish',
    inheritance:     'random',
    note:            'A random varnish roan coat. COMPLETELY RANDOM: the parents’ coats do not affect it and it cannot be inherited or bred for.',
  },
};
