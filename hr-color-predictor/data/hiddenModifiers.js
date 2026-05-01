// Hidden modifier loci that never surface in the in-game test result.
// The user declares each horse's state via the hidden gene panel.
//
// Not included here: A+ and At (Agouti slot ambiguity). Those are handled
// separately in hiddenGenePanel.js as per-slot dropdowns on an existing 'A'
// allele, not as a whole-pair tri-state.
//
// Each entry:
//   label    user-facing gene name
//   options  all valid allele pairs, in display order (non-carrier → homozygous)
//   default  pair applied automatically when the breed has this locus in `hidden`
//            and the user has not toggled it explicitly

export default {
  f: {
    label:   'Flaxen',
    options: [['F', 'F'], ['F', 'f'], ['f', 'f']],
    default: ['F', 'F'],
  },
  STY: {
    label:   'Sooty',
    options: [['n', 'n'], ['STY', 'n'], ['STY', 'STY']],
    default: ['n', 'n'],
  },
  PA: {
    label:   'Pangaré',
    options: [['n', 'n'], ['PA', 'n'], ['PA', 'PA']],
    default: ['n', 'n'],
  },
  // HR-custom hidden white-pattern modifiers (planning 2.6).
  // Listed under `whites` in genesMapping (matching the reference HTML's column),
  // but never appear in DOM. Panel surfaces them as tri-state toggles whenever
  // the breed has them in `hidden` OR `whites`.
  Y: {
    label:   'Sabino hidden',
    options: [['n', 'n'], ['Y', 'n'], ['Y', 'Y']],
    default: ['n', 'n'],
  },
  rb: {
    label:   'Rabicano',
    options: [['n', 'n'], ['rb', 'n'], ['rb', 'rb']],
    default: ['n', 'n'],
  },
  WM: {
    label:   'White Markings',
    options: [['n', 'n'], ['WM', 'n'], ['WM', 'WM']],
    default: ['n', 'n'],
  },
  PATN2: {
    label:   'PATN2',
    options: [['n', 'n'], ['PATN2', 'n'], ['PATN2', 'PATN2']],
    default: ['n', 'n'],
  },
};
