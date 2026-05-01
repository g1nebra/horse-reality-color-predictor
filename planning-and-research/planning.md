# HR Color Predictor, Chrome Extension
## Planning Document v1.0 | April 2026

> **Source of truth for all genetics data: `hr_genetics_reference_claymore_v1.html`**  
> Any conflict between this document and the HTML reference, the HTML wins.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Genetics Reference](#2-genetics-reference)
3. [In-Game Mechanics](#3-in-game-mechanics)
4. [Breed Reference Data (33 breeds)](#4-breed-reference-data)
5. [Technical Architecture](#5-technical-architecture)
6. [Data Layer](#6-data-layer)
7. [Development Phases](#7-development-phases)
8. [Open Questions](#8-open-questions)

---

## 1. Project Overview

### 1.1 What is HR Color Predictor?

HR Color Predictor is a Chrome extension for the browser game Horse Reality. It reads the genotype data already visible on a horse's profile page, lets the player designate a dam and a sire, and instantly calculates every possible colour outcome for their offspring, showing genotype, phenotype, colour name, and probability percentage for each result.

The goal is to eliminate manual cross-referencing and guesswork. Players who want to breed for a specific coat colour currently have to calculate Punnett squares by hand or use external spreadsheets. HR Color Predictor makes that instant, in-browser, and breed-aware.


### 1.2 Scope

| | |
|---|---|
| **Platform** | Google Chrome desktop (Manifest V3 extension) |
| **Game** | Horse Reality (horsereality.com) |
| **Breeds covered** | 33 breeds documented at launch |
| **Loci in v1** | Extension (E/e), Agouti (A+/A/At/a), Cream+Pearl (shared locus), Dun (D/nd1/nd2), Champagne (CH), Silver (Z), Mushroom (mu) |
| **Loci in v2** | Grey (G), Flaxen (f), Sooty (STY), Pangaré (PA), and all white patterns (Tobiano, Roan, Frame, SB1, LP, W-series, Splashed White, Rabicano, Hidden Sabino, WM) |
| **Build system** | None, vanilla JS, no bundler, load unpacked in Chrome |
| **Data storage** | `chrome.storage.sync` (pairings persist across sessions) |

---

## 2. Genetics Reference

### 2.1 The Basics

Every horse has two copies of each gene, one inherited from the dam, one from the sire. The specific location of a gene on the chromosome is called a locus (plural: loci). The different possible variants of a gene are called alleles.

When a horse has two identical alleles it is **homozygous**. When it has two different alleles it is **heterozygous**. Whether a horse shows a trait on the outside (its phenotype) depends on how the two alleles interact.

| Term | Meaning | Example |
|---|---|---|
| Locus | The gene's location on the chromosome | Extension locus |
| Alleles | The possible variants at that locus | `E` (black pigment) and `e` (no black pigment) |
| Homozygous | Both copies are the same allele | `E/E` or `e/e` |
| Heterozygous | Each copy is a different allele | `E/e` |
| Genotype | The actual allele combination the horse carries | `E/e` |
| Phenotype | What the horse looks like based on its genotype | Black coat (can produce black or bay) |

### 2.2 Dominance

- **DOMINANT** alleles (written in capitals, e.g. E, A, CH) only need one copy to show.
- **RECESSIVE** alleles (written in lowercase, e.g. e, a, prl) need two copies to be visible.
- **INCOMPLETE DOMINANT** alleles behave differently depending on how many copies are present. Cream (CR) is the most important example.

### 2.3 Base Colour

Every horse's colour starts with its base colour, set by just two genes: Extension and Agouti. Every dilution and modifier is layered on top of this.

**EXTENSION (E/e)**

Controls whether black pigment can be produced at all.
- At least one `E` → horse can produce black pigment (black or bay base)
- `e/e` → horse cannot produce black pigment → chestnut regardless of Agouti status
  - Agouti still matters for passing alleles to offspring but has no visual effect on chestnuts

**Fixed-extension breeds (engine must handle as special cases):**

| Breed | Fixed base | Effect |
|---|---|---|
| Exmoor Pony | Bay/dun base | No Extension locus in test results; Black and Chestnut cannot appear |
| Haflinger | Chestnut (e/e) | No Extension locus in test results; all Haflingers are chestnut |
| Suffolk Punch | Chestnut (e/e) | No Extension locus in test results; all Suffolk Punches are chestnut |
| Friesian | Black (a/a) | No Agouti effect; Bay, Wild Bay, Seal Brown cannot appear |

**AGOUTI (A+, A, At, a)**

Only has a visible effect on horses that can produce black pigment **(E/e or E/E)**.

| Allele | Name | Effect |
|---|---|---|
| A+ | Wild Bay | Restricts black to very low on the legs. **Hidden in HR**, test shows "A". |
| A | Bay | Restricts black to points (legs, mane, tail, ear tips). |
| At | Seal Brown | Restricts black but allows tan on soft body parts. **Hidden in HR**, test shows "A". |
| a | Black | Black pigment unrestricted, covers the whole body. |

Priority order: `A+ > A > At > a`

**Base colour quick reference:**
```
E/_ + a/a  = Black
E/_ + A+/_ = Wild Bay
E/_ + A/_  = Bay
E/_ + At/_ = Seal Brown
e/e + any  = Chestnut (agouti irrelevant visually, but still inherited by offspring)
```

### 2.4 Dilutions

Dilutions always act on top of the base colour.

**CREAM (CR) + PEARL (prl), shared locus**

CR and prl occupy the same locus, so a horse only ever carries two alleles across both. All valid combinations and their effects:

| Genotype | Effect |
|---|---|
| `CR/n` | Single cream. Dilutes red pigment strongly, barely affects black. Chestnut→Palomino, Bay→Buckskin, Black→Smoky Black |
| `CR/CR` | Double cream. Dilutes both pigments to pale creamy. Pink skin, blue eyes. Chestnut→Cremello, Bay→Perlino, Black→Smoky Cream |
| `CR/prl` | Pseudo-double dilute. Behaves similarly to `CR/CR`, much lighter than either single dilute alone |
| `prl/prl` | Double pearl. Dilutes both red and black to golden/tan tones. Resembles Champagne but with mottled skin |
| `prl/n` | Carrier only. No visible effect |
| `n/n` | No dilution |

HR Breeds with both CR and prl visible: **Irish Cob, Lusitano, Pura raza española, Quarter Horse, Mustang**

**DUN (D/nd1/nd2), three-allele locus**

Strict dominance order: `D > nd1 > nd2`

| Allele | Effect |
|---|---|
| D (dun) | Dominant. Dilutes body colour AND adds primitive markings (dorsal stripe, leg barring, shoulder stripe, face mask, frosting). |
| nd1 (non-dun1) | Recessive to D, dominant over nd2. Adds primitive markings **without** diluting body colour. |
| nd2 (non-dun2) | Fully recessive. No visible effect. The baseline allele. May appear explicitly in test results (confirmed: Knabstrupper, Quarter Horse show `nd2 / nd2`). Parser must handle it whether read from DOM or inferred. |

Outcomes:
```
D/_     = Dun (dilution + primitive markings)
nd1/nd1 = Primitive markings only, no dilution
nd1/nd2 = Primitive markings only, no dilution
nd2/nd2 = No effect
```

> **Engine note:** nd2 is the default/implicit non-dun allele in most breeds. However, some breeds (confirmed: Knabstrupper) **do** show nd2 explicitly in test results (e.g. `nd2 / nd2`). The parser must handle nd2 appearing in the DOM; do not assume it is always implicit. Treat nd2 as the null allele in engine logic regardless of whether it was read from the DOM or inferred.

**CHAMPAGNE (CH), dominant**

Dilutes both red and black pigment. All champagne horses have mottled (freckled) pink skin and amber or hazel eyes. Foals are born darker with blue eyes and lighten quickly. Stacks with Cream, buckskin champagne is its own colour.

**SILVER (Z), dominant, black pigment only**

Silver ONLY dilutes black pigment. Chestnuts (`e/e`) have no black pigment, Silver has no visual effect on them, they can only carry it silently and pass it to offspring. On black and bay horses, Silver dilutes the mane, tail, and feathering to near-white. Silver blacks often show striking dapples.

**MUSHROOM (mu), recessive, red pigment only**

Two copies (`mu/mu`) required. Dilutes the coat to a sepia-toned colour on chestnut and bay-based horses, often with a lighter mane/tail.

### 2.5 Override Hierarchy

When multiple genes are present, the predictor applies them in this order:

1. **Extension (E/e)**, Always first. `e/e` = chestnut, Agouti irrelevant visually.
2. **Agouti (A+/A/At/a)**, On all black-based horses. Order: `A+ > A > At > a`.
3. **Cream (CR)**, Dosage-sensitive. Single copy dilutes red only; double dilutes both. Evaluated before other dilutes due to Pearl interaction.
4. **Pearl (prl)**, Evaluated together with Cream (shared locus). `CR/prl` = double dilute.
5. **Champagne (CH)**, Dominant. Stacks with Cream.
6. **Dun (D/nd1)**, Stacks with all above. Adds primitive markings on resolved colour.
7. **Silver (Z)**, Only applies to black-based horses.
8. **Mushroom (mu)**, Recessive, two copies required. Only applies to red-pigment horses.

**Example:**  
Genotype: `E/e, A/a, CR/n, D/nd2`  
→ E present → black pigment possible → A present → bay base → CR/n → buckskin → D/nd2 → dun allele present → primitive markings  
→ **Buckskin Dun**

### 2.6 Hidden Genes

Some genes exist in the game but are not shown in test results. The user must toggle them manually.

Each breed has a defined list of which genes are hidden (present but untestable) versus which simply do not exist in that breed at all. The toggle panel only shows the hidden genes relevant to that breed.

**HR-custom genes (follow HR-team rules only, not real-world genetics):**

| Gene | Notes |
|---|---|
| Hidden Sabino (Y) | Recessive, untestable. `Y` is the in-game allele symbol. Requires `Y/Y` to visually manifest in most breeds. |
| Rabicano (rb) | Modelled as a simple recessive hidden gene. Requires `rb/rb` to show. |
| White Markings (WM) | Hidden gene controlling face and leg marking size. |
| PATN2 | Hidden leopard complex modifier. No real-world testable equivalent. Produces snowcap/blanket patterns on LP horses. |
| Snowdrop (sno) | Breed-specific modifier **(Irish Cob - NOT IMPLEMENTED YET)**. Was first identified in a Gypsy mare that appeared to be smokey cream, but did not carry any of the known dilution or white-spotting genes. After testing, along with research to her relatives, a unique genetic change was found in the SLC45A2 gene that explained her unusual appearance. This newly identified mutation was officially named Snowdrop (SNO). Homozygous `sno/sno`: Horses with two copies of the gene show a strong dilution of black pigment in the mane and tail, often appearing pale with pink skin around the muzzle and white eyelashes. Heterozygous `sno/n`: Horses with just one copy appear to have no effect on phenotype, unless paired with another dilution gene such as Cream (CR), Pearl (PRL), or Sunshine (SUN).

### 2.7 Lethal Combinations

**FRAME OVERO (OLW/OLW), Overo Lethal White Syndrome**

Two OLW carriers → 25% chance foal inherits two copies. OLW/OLW foals are born with an underdeveloped intestinal tract and cannot survive. In-game, you will receive a notification when a foal is born with OLWS, which mentions that the foal had to be humanely euthanised.

Breeds with Frame (Overo) confirmed: **Mustang, Quarter Horse, Thoroughbred (TB)**

**HOMOZYGOUS WHITE SPOTTING (Wx/Wx)**

Almost all white spotting alleles are embryonic lethal when homozygous, the breeding produces no foal (failed covering).
**Exception: W20/W20 is viable**, the only viable homozygous white spotting in-game.

---

## 3. In-Game Mechanics

These HR-specific mechanics differ from real-world genetics and affect how the engine displays results.

| Mechanic | Detail |
|---|---|
| **Grey (G) at adulthood** | Grey overrides all other colour expression visually at adulthood. In-game, the adult grey phenotype is **randomly chosen** from that breed's grey pool (dapple grey, steel grey, fleabitten, white, etc.). Foals are born hyperpigmented with darker coats and may show grey goggles around the eyes. |
| **Roan (RN) age gate** | Roan does not show on foals. The roan coat only appears when the horse **turns 3 years old** in-game. |
| **Sooty (STY) dominance rules** | *(v2, defer to Phase 7)* Dominant on bay-based coats (single copy shows); recessive on chestnut in most breeds (two copies needed). **Exceptions:** Lusitano, Trakehner, Oldenburg, and Haflinger treat STY as incomplete dominant on chestnut. Black-based horses never express sooty. Masked on foals, under Grey, on double dilutes, and under Dun (except Kathiawari, the only breed with sooty dun). |
| **W20/W20 viability** | All homozygous white spotting combinations are embryonic lethal except W20/W20. |

---

## 4. Breed Reference Data

Data from `hr_genetics_reference_claymore_v1.html`. Categories: **visible** (testable in-game), **hidden** (present but untestable), **whites** (white patterns in-game), **suspected** (not yet confirmed), **no evidence**.

| # | Breed | Status | Notable engine notes |
|---|---|---|---|
| 1 | Akhal-Teke | complete | SW-like mutation suspected. Y expression varies with other genes. |
| 2 | Arabian | incomplete | W3 and W19 breed-specific whites. W15, W23, W34 suspected. More whites may be added. |
| 3 | Brabant Horse | complete | A+ has no evidence (agouti is A/At/a only). Pangaré hidden, only affects non-black. |
| 4 | Brumby | incomplete | Grey and Cream are hidden (not visible in test results) despite being present. |
| 5 | Camargue Horse | incomplete | Chestnuts lighten with age, NOT a greying effect in-game. Limited genetic diversity. |
| 6 | Cleveland Bay | complete | Predominantly bay. Grey and most dilutes absent. A+ no evidence (A/At/a only). |
| 7 | Exmoor Pony | complete | **Extension fixed**, effectively bay/dun base. Black and Chestnut cannot appear. |
| 8 | Finnhorse | incomplete | Rabicano recessive hidden (two copies needed). Roan from age 3. |
| 9 | Fjord Horse | incomplete | Rich dun traits standard. Pangaré visible and standard. No hidden genes. |
| 10 | Friesian | complete | **Agouti fixed (a/a)**, effectively black. Bay/Wild Bay/Seal Brown cannot appear. Chestnut technically possible but extremely rare. |
| 11 | Haflinger | complete | **Extension fixed (e/e)**, all chestnut. Flaxen hidden but fixed. Nd1 gives dorsal stripe without dun dilution. STY incomplete dominant on chestnut (STY/n ≠ STY/STY visually). |
| 12 | Icelandic Horse | complete | W8 and W21 are Icelandic-specific. One of the most genetically diverse breeds. Roan from age 3. |
| 13 | Irish Cob Horse | incomplete | LP present (unusual for cob). Cream+Pearl share locus. SB1/SB1 ≈ nearly white. Snowdrop (sno) suspected. |
| 14 | Kathiawari | complete | One of few breeds with no 'no evidence' column. **Only breed where sooty expresses on dun coats.** |
| 15 | Kladruber | incomplete | Predominantly grey or black. Rabicano hidden recessive. |
| 16 | Knabstrupper | incomplete | LP defining pattern. LP incomplete dominant: LP/lp = spotted, LP/LP = snowcap/few-spot. PATN1 testable; PATN2, sooty, flaxen, and white markings are all hidden/untestable. At is hidden (testable: A and a only). nd2 shown explicitly in test results. W20 not yet in-game (pending v2 transfer). |
| 17 | Lipizzaner | complete | Born dark, turn grey. Grey dominant/iconic trait. Adult grey randomly chosen from breed pool. |
| 18 | Lusitano | incomplete | Cream+Pearl share locus. SW-like mutation suspected. STY incomplete dominant on **all** base coats including red flaxen. No sooty seal buckskin artwork (reported bug). |
| 19 | Mongolian Horse | complete | LP present (unusual for Asian breed). PATN2 hidden but in-game. Roan from age 3. |
| 20 | Mustang | incomplete | ⚠ **Frame (OLW) present**, OLWS risk. Cream+Pearl share locus. Most genetically diverse breed. Grey and LP only suspected. |
| 21 | Namib Desert Horse | incomplete | Nd1 present (markings without dilution). "Lacing" suspected, breed-specific modifier, unknown genetics. Very incomplete dataset. |
| 22 | Noriker | incomplete | LP present (appaloosa-style patterns). Always flaxen carriers. Y recessive, needs Y/Y to show. W17 is a breed-specific allele. |
| 23 | Norman Cob | complete | Relatively simple genetics. Grey overrides at adulthood. |
| 24 | Oldenburg | incomplete | W16 breed-specific white spotting allele. STY incomplete dominant on chestnut but recessive on red flaxen. No sooty bay/buckskin/seal buckskin artwork after redo. |
| 25 | Pantaneiro | complete | South American breed. No suspected entries. Roan from age 3. |
| 26 | Pura raza española | incomplete | Cream+Pearl share locus. SW9 and SW10 suspected breed-specific splashed whites. Closely related to Lusitano. |
| 27 | Quarter Horse | incomplete | ⚠ **Frame (OLW) present**, OLWS risk. Cream+Pearl share locus. W10 breed-specific. Champagne and Silver are visible (one of few breeds with testable Champagne). Many suspected whites. |
| 28 | Shetland Pony | incomplete | Mushroom (mu) visible and testable. Silver visible. SB1/SB1 ≈ nearly white. W13 suspected. Roan from age 3. |
| 29 | Shire Horse | complete | W20/W20 viable (unique). All other Wx/Wx = embryonic lethal. Y recessive hidden. |
| 30 | Suffolk Punch | complete | **Extension fixed (e/e)**, all chestnut. Bay (A) allele absent, agouti irrelevant to colour (only matters for offspring). |
| 31 | Thoroughbred (TB) | incomplete | ⚠ **Frame (OLW) present**, OLWS risk. Many suspected whites (W2, W5–W7, W14, W22, W25–W27) reflecting real-world research. |
| 32 | Trakehner Horse | incomplete | Tobiano present (homozygous TO/TO = ink spots/cat tracks). STY incomplete dominant on all coats except red flaxen (recessive on red flaxen). Roan from age 3. |
| 33 | Welsh Ponies (A-B) | incomplete | Covers Section A and B. Silver visible. Rabicano hidden recessive. Roan from age 3. |

---

## 5. Technical Architecture

### 5.1 Extension Type

Manifest V3 (MV3). Uses service workers instead of background pages. No service worker needed for v1, all logic runs in the content script or sidebar panel.

The sidebar is **manually triggered** by the user via the extension's browser action button in the Chrome toolbar. It does not open automatically on page load.

### 5.2 File Structure

```
hr-color-predictor/
  manifest.json
  content.js
  sidebar/
    sidebar.html
    sidebar.css
    sidebar.js
    components/
      pairingManager.js
      horseSelector.js
      hiddenGenePanel.js
      resultsPanel.js
  engine/
    genotypeParser.js
    punnettEngine.js
    phenotypeResolver.js
  data/
    colorRules.json
    genesMapping.json
```

### 5.3 Module Responsibilities

**`manifest.json`**  
Declares the extension to Chrome. Specifies permissions (`activeTab`, `storage`, `sidePanel`), content script injection rule (matches `horsereality.com/*`), and the sidebar panel entry point.

**`content.js`**  
Injected into every Horse Reality page. Reads the horse's breed and visible genotype table from the DOM. Injects the "Set as Dam" / "Set as Sire" badge. Communicates with the sidebar via `chrome.sidePanel` API and `postMessage`. Does NOT run any genetics logic, purely a data reader and message relay.

**`genotypeParser.js`**  
Takes raw DOM data from `content.js` and converts it into a structured allele object. Example output:
```js
{ E: ['E','e'], A: ['A','a'], CR: ['CR','N'], dun: ['D','nd2'] }
```

**DOM structure (confirmed consistent across all breeds):**
- Container: `div.grid_6.genetics`
- Three `div.subtop` section headers: `"Colours & Modifiers"`, `"Dilutions"`, `"White Patterns"`. Parser ignores subtop labels, select all `div.genetic_table_row` elements regardless of section.
- Each gene row: `div.genetic_table_row` containing:
  - `div.genetic_name`: display name of the locus (e.g. `"Extension"`, `"Agouti"`, `"Appaloosa"`)
  - `div.genetic_result`: allele pair as `"X / Y"` (split on `" / "`). Untested loci show `"? / ?"`, the row is always present, structure is identical.
  - `div.genetic_tests`: one `div.test_block` per allele tested. Each contains an `<img>` with `alt="Tested"` (green checkmark, `icon/checkmark.png`) or `alt="Not tested"` (red cross, `icon/cross.png`). Use `alt` to determine test status per locus.
- **Completely untested horse detection:** all `genetic_result` divs contain `"? / ?"` → pick disabled.
- **Partially tested horse detection:** at least one `"? / ?"` among otherwise tested rows → pick allowed, flag shown.
- Genes absent from a breed simply have no row, no special handling needed.
- The KIT locus groups multiple genes (e.g. Tobiano + Roan) into one row with a single result.
- Display names don't always match gene keys, parser needs a `displayName → locusKey` mapping. Confirmed mappings so far: `"Appaloosa" → "LP"` (test badge reads "Leopard"), `"Creampearl" → "CR/prl"`, `"MITF" → SW1+SW3 grouped row`, `"SW2" → sw2 own row`, `"KIT" → parsed separately for TO/RN/SB1/W-alleles`

Also merges any hidden gene toggles set by the user before passing to the engine. Must handle fixed-base breeds (stub absent loci as homozygous defaults).

**`punnettEngine.js`**  
Core calculation module. Takes two structured allele objects (dam + sire) and computes every possible offspring genotype across all loci. For each locus: generates the four allele combinations from both parents. Combines all loci, sums probabilities for identical genotypes, returns a flat array of `{ genotype, probability }` objects.

**`phenotypeResolver.js`**  
Takes a combined genotype object and returns the resolved phenotype and colour name by applying the override hierarchy (see 2.5). Looks up the final colour name from `colorRules.json`. Flags lethal combinations before returning.

**`colorRules.json`**  
Maps genotype signatures to human-readable colour names as used in Horse Reality. Built from the HR wiki colour name tables. Extended as new loci are added.

**`genesMapping.json`**  
Breed-keyed file recording for every breed which genes are visible, hidden, white patterns, suspected, or absent. See 6.2 for structure.

### 5.4 Horse Selection & Pairing UX

#### Picking a horse

The user can pick any horse from that horse's profile page, regardless of life stage (colt, filly, mare, stud). When the user clicks "Pick this horse", `content.js` captures and saves:

| Field | Source |
|---|---|
| Profile URL | Current page URL |
| Name | DOM read from page |
| Photo | DOM read  see note below |
| Genetic table | DOM read via `genotypeParser.js` |

**Photo storage:** The extension stores the image URL string only. Detection via `<figure>` contents after excluding the background `<img>` (`assets.horsereality.com/c/backgrounds/`):
- **New system**  one `<img>` remaining, URL on `horse-img.horsereality.com`. Capture that URL directly.
- **Old system**  multiple `<img>` tags remaining, URLs on `horsereality.com/upload/colours/` and `/upload/whites/` (separate layers for body, tail, mane, whites). No single URL to capture; store a placeholder and flag as old system. User can Update once the horse migrates.

**Prerequisite:** The horse must have at least one tested gene. If every gene shows `?/?` (completely untested), the pick button is disabled. Partially tested horses are pickable; untested loci are excluded from calculation and the pairing card shows a "not fully tested" flag. Partial testing is normal  players often skip genes that don't visually apply to their breed (e.g. Grey on a Noriker).

**Pick vs Update:** If the user visits the profile page of a horse that is already saved in a pairing, the button shows "Update" instead of "Pick". Pressing it re-reads the horse's genotype, photo, and name and refreshes all pairings that horse appears in. This covers both new lab results coming in and adult art replacing foal art.

#### Pairing model

Pairings are not required to be complete at creation time. A pairing is a slot that holds up to one dam and one sire. Either slot can be empty. Examples of valid saved state:

```
Pairing 1: Mare A | (empty)
Pairing 2: (empty) | Stud B
Pairing 3: Mare C | Stud D
```

The Punnett square is only available (and the pairing card is interactive for results) when **both** slots are filled.

#### Opposite-gender selection flow

When the user picks a horse, the extension checks the current sidebar state and prompts:

- **Create new pairing:** opens a new pairing with this horse in the appropriate slot (dam or sire), the other slot left empty.
- **Add to existing pairing:** only offered when at least one existing pairing of the same breed has an empty slot of the matching gender. The user selects which pairing to fill.

Same-breed enforcement applies at this step. Cross-breed pairings are not permitted.

#### Pairing list & Punnett square

- All pairings (complete and incomplete) are saved to `chrome.storage.sync` and persist across sessions.
- Each pairing is displayed as a card showing dam and sire slots (photo + name, or a placeholder if empty).
- Clicking a **complete** pairing card opens the Punnett square view for that pair.
- Any pairing can be individually removed from the list.
- Individual slots are replaceable  clearing one slot leaves the other intact.
- A pairing can be duplicated, producing a copy with the same horses in new slots.
- A horse already in a pairing can be selected directly from their pairing card to add to another pairing or create a new one  the user does not need to navigate back to that horse's profile page to reuse them.

#### Export and import

Pairings can be exported as plain text (one or all) and re-imported. Format is human-readable, copy-paste friendly, and shareable between players.

**Export format:**

```
[Pairing Name]
Breed: Quarter Horse

Dam: Sunshine (https://v2.horsereality.com/horses/12345)
Extension: E / e
Agouti: A / a
Creampearl: CR / n
Dun: nd2 / nd2
Champagne: ch / ch
Silver: z / z
Mushroom: n / n

Sire: Tornado (https://v2.horsereality.com/horses/67890)
Extension: E / E
Agouti: A / a
Creampearl: n / n
Dun: nd2 / nd2
Champagne: ch / ch
Silver: z / z
Mushroom: n / n
```

- Empty slots shown as `(empty)`.
- Multiple pairings separated by a blank line.
- JSON export available as an alternative.
- Photos are not included. Imported horses show a placeholder until the user visits the page and hits Update.

**Import validation:** the importer rejects anything that does not pass these checks:

- Breed name must match a known HR breed exactly.
- Both horses in a pairing must share the same breed.
- Locus names must be valid for that breed. Unknown loci are rejected, not silently ignored.
- Allele values must be valid for that locus (e.g. `CR / e` is not a valid Creampearl result).
- Each locus must have exactly two alleles.
- Two horses of the same gender in one pairing are rejected.

Invalid pairings are skipped with a per-pairing error message. Valid pairings in the same file are still imported. Import always appends, never overwrites.

#### Future version (photo update for colts & fillies)

The Update button (see Pick vs Update above) already handles genotype refreshes in v1. For colts and fillies, the adult art will differ from the foal art captured at pick time. In a future version, visiting the horse's adult profile and pressing Update will refresh the photo specifically without requiring the user to re-enter the pairing. This is the same Update flow, no new mechanism needed  just a note that adult art should replace foal art when it becomes available.

---

## 6. Data Layer

### 6.1 Loci in v1

| Locus | Key | Type | Alleles | Notes |
|---|---|---|---|---|
| Extension | E | Recessive | E / e | e/e = chestnut, overrides Agouti visually |
| Agouti | A | Dominance hierarchy | A+ / A / At / a | A+ and At are hidden, tests show only "A". A+ > A > At > a |
| Cream/Pearl | CR | Shared locus | CR / prl / N | Incomplete dominant. CR and prl share locus, CR/CR + prl/prl impossible |
| Dun | dun | 3-allele hierarchy | D / nd1 / nd2 | D > nd1 > nd2. nd2 is the implicit null allele (not listed in HR test results) |
| Champagne | CH | Dominant | CH / ch | Dilutes both pigments. Mottled skin + amber eyes |
| Silver | Z | Dominant | Z / z | Black pigment only. Chestnuts carry silently |
| Mushroom | mu | Recessive | mu / N | Red pigment only. Two copies required to show |

### 6.2 Loci Deferred to v2

| Locus group | Loci | Reason for deferral |
|---|---|---|
| Hidden modifiers | Grey (G), Flaxen (f), Sooty (STY), Pangaré (PA) | Hidden genes needing toggle UI. Grey overrides all colour at adulthood and has breed-specific random pool logic. |
| White patterns | Tobiano (TO), Roan (RN), Frame (OLW), Sabino 1 (SB1), Leopard (LP), PATN1 | Separate pattern layer. Lethal combos need flagging logic. Roan has age-gate mechanic. |
| W-series | W3, W8, W10, W16, W17, W19, W20, W21 | Breed-specific alleles at KIT locus. W20/W20 is the only viable homozygous W. |
| Splashed White | MITF-SW1, PAX3-SW2, and others | Multiple alleles at MITF/PAX3. SW1/SW1 homozygous increases white expression. |
| HR-custom patterns | Hidden Sabino (Y), Rabicano (rb), White Markings (WM), PATN2, Snowdrop (sno) | HR-custom implementations. Rules from HR wiki only. |

### 6.3 `genesMapping.json` Structure

The JSON is keyed by the exact breed name string from the HTML. Five categories match the HTML reference columns:

```json
{
  "Pura raza española": {
    "visible":   ["E", "e", "A", "G", "CR", "prl"],
    "hidden":    ["At", "f"],
    "whites":    ["WM", "rb"],
    "suspected": ["nd1", "D", "STY", "KIT-W20", "MITF-SW9", "MITF-SW10"],
    "none":      ["A+", "PA", "CH", "Z", "mu", "OLW", "LP", "PATN1", "PATN2", "Y", "TO", "SB1", "RN"]
  }
}
```

> The `visible` and `hidden` categories drive the engine. `whites` feeds the v2 white-pattern layer. `suspected` and `none` are informational only, not used in v1 calculations.

### 6.4 `colorRules.json`

Maps genotype signatures to human-readable HR colour names. **Deferred beyond v1:** the v1 results panel shows genotype and probability only. `colorRules.json` and `phenotypeResolver.js` will be built in a post-v1 pass once the engine and UI are stable.

---

## 7. Development Phases

### Phase 0, Data Foundation
**Deliverables:** `genesMapping.json` populated for all 33 breeds. Breed research complete. `colorRules.json` is deferred, not needed for v1.  
**Ready when:** Research done (manual, by project owner).

**Early start threshold:** Base colour and dilute loci confirmed for at least 5 breeds covering a variety of genetic complexity, and at least one example of each v1 locus (CR, prl, D, nd1, CH, Z, mu) documented. Phase 1 can begin while research continues in parallel.

### Phase 1, Engine Core
**Deliverables:** `genotypeParser.js`, `punnettEngine.js`, `phenotypeResolver.js`. Unit-tested against known breeding pairs.  
**Ready when:** Phase 0 threshold met.

### Phase 2, Extension Scaffold
**Deliverables:** `manifest.json`, `content.js` DOM reader, sidebar HTML/CSS shell, `chrome.sidePanel` integration.  
**Ready when:** Phase 1 complete.

### Phase 3, Horse Selection UI
**Deliverables:** Dam/sire badge on page, horse selector flow, breed lock (same-breed only), `chrome.storage` for saved pairings. Pairing model supports incomplete pairings (one slot filled, one empty). Prompt on opposite-gender pick: create new pairing or add to existing same-breed pairing with an open slot. See 5.4 for full UX spec.  
**Ready when:** Phase 2 complete.

### Phase 4, Results Display
**Deliverables:** Punnett grid component, probability table showing genotype + probability per outcome. Lethal combo warnings. Colour names deferred: v1 shows genotype only, no `phenotypeResolver.js` or `colorRules.json` lookup required at this stage.  
**Ready when:** Phase 3 complete.

### Phase 5, Hidden Gene Panel
**Deliverables:** Per-breed hidden locus toggles. User-selectable suspected genotype (e.g. `prl/N`, `prl/prl`). Integrated into engine call.  
**Ready when:** Phase 4 complete.

### Phase 6, v1 Release
**Deliverables:** Error handling, edge cases (fixed-base breeds, locus-absent breeds), export/import (plain text + JSON, with full validation), README, load-unpacked instructions. Pack as `.zip`.  
**Ready when:** Phase 5 complete.

### Phase 7, v2 Modifiers
**Deliverables:** Grey, Flaxen, Sooty, Pangaré hidden gene toggles. Grey resolver special case (overrides all at adulthood, breed-specific random pool). Sooty breed-specific dominance rules (see 3).  
**Ready when:** After v1 stable.

### Phase 8, v2 White Patterns
**Deliverables:** Tobiano, Roan (age-3 display note), Frame (OLWS warning), SB1, LP + PATN1/PATN2, W-series, Splashed White, HR-custom patterns (Y, rb, WM, sno). Full lethal combo detection.  
**Ready when:** After Phase 7.

### Phase 9, Results Summary View
**Goal:** Make results readable at a glance for horses with many loci (e.g. Norikers with E + A + LP + PATN1 + KIT = 72 combinations).

**Deliverables:**

#### 9.1 Per-locus probability summary (always shown above the table)
Collapse all outcomes by a single locus to answer "what are the odds my foal carries X?".  
For each locus in the shared set, show a mini breakdown:

| Locus | Outcome | % |
|-------|---------|---|
| KIT   | RN/TO   | 37.5% |
| KIT   | RN/RN   | 12.5% |
| LP    | lp/lp   | 50% |
| …     | …       | … |

Implementation: group `calculateOffspring` results by one locus at a time, sum probabilities for each distinct allele pair. One pass per locus, O(n) per locus.

#### 9.2 Combination filter (interactive)
Checkboxes or chips for each locus outcome (e.g. "LP/lp ✓", "RN/TO ✓"). When one or more are checked, the full genotype table below filters to only rows that include ALL selected criteria and shows the combined probability at the top ("Probability of this combination: 18.75%").

Implementation: the full outcomes array is already in memory, filtering is client-side. No engine changes needed.

#### 9.3 UX layout
- Summary strip above the genotype table (collapsible).
- Combination chips row below the summary.
- Full genotype table remains, now filtered by active chips.
- "Clear filters" button resets to showing all rows.

**Ready when:** After Phase 6 (v1 stable). No engine changes needed, pure UI on top of existing `calculateOffspring` output.

---

## 8. Open Questions

| # | Question | Status | Blocks |
|---|---|---|---|
| 1 | Does Horse Reality use a consistent HTML structure for the genetics table across all 33 breeds, or does it vary per breed? | **RESOLVED**, structure is consistent, universal parser is viable. See `genotypeParser.js` DOM notes in 5.3. | `genotypeParser.js` design |
| 2 | Which breeds implement the nd1/nd2 distinction for Dun? | **RESOLVED** from HTML. nd2 is always the implicit null (never surfaces in test results). Breakdown: **Both D + Nd1 visible:** Icelandic, Kathiawari, Knabstrupper, Mongolian, Pantaneiro, Shetland. **Nd1 visible only (no D):** Akhal-Teke, Haflinger, Lipizzaner, Namib, Oldenburg, Thoroughbred. **D visible, Nd1 suspected:** Brumby, Exmoor, Fjord, Irish Cob, Mustang, Quarter Horse, Welsh Ponies A-B. **D suspected, Nd1 visible:** Lusitano, Pura raza española. **D suspected, Nd1 suspected:** Arabian, Finnhorse. **No dun loci:** remaining 10 breeds. | Allele notation in engine and results display |
| 3 | Is the "Sabino hidden (Y)" notation from the HTML an in-game allele symbol, or does it just mean "yes, this breed has hidden sabino"? | **RESOLVED**, Y is the in-game allele symbol. Requires Y/Y to visually manifest in most breeds. | `genesMapping.json` notation and toggle label copy |
| 4 | For breeds where Extension is fixed, should the parser skip Extension entirely or model it as homozygous? | **RESOLVED**  any gene that is fixed in a breed is modelled as homozygous in the engine. The DOM reader skips it (it won't appear in test results), and `genesMapping.json` stubs it in as the fixed homozygous genotype before the engine runs. This applies to all fixed genes, not just Extension: e.g. Haflinger (e/e), Suffolk Punch (e/e), Friesian (a/a), Exmoor Pony (bay/dun base), Noriker (always flaxen carriers  f/f once flaxen is implemented in v2). | Edge case handling in `genotypeParser.js` and `punnettEngine.js` |
| 5 | Does the Knabstrupper LP implementation follow standard LP/lp + PATN1/PATN2 rules, or are there breed-specific quirks? | **RESOLVED**  no breed-specific quirks. LP is standard incomplete dominant (LP/lp = spotted, LP/LP = snowcap/few-spot). PATN1 is testable; PATN2, sooty, flaxen, and white markings are all hidden/untestable. PATN dosage (via PATN1 and hidden PATN2) controls white coverage amount within each LP outcome. Snowcap vs few-spot distinction within LP/LP is governed by PATN copy count (standard real-world rule, no HR overrides confirmed). | v2 LP resolver logic |
| 6 | Exact UX for the breed mismatch warning, modal, inline error, or prevent assignment entirely? | **RESOLVED** no warning needed. The "Add to existing pairing" list is filtered to same-breed pairings only. Cross-breed options are never shown, so the user cannot attempt an invalid assignment. No error state required. | Phase 3 UI |
| 7 | How does the engine handle the 3-allele Dun locus? | **RESOLVED** no special handling needed. Each horse always carries exactly 2 alleles regardless of how many alleles exist in the breed pool. `punnettEngine.js` always crosses `[dam_a1, dam_a2] × [sire_a1, sire_a2]` → 4 combinations at 25% each. This logic is already N-allele compatible. The 6 possible Dun genotypes (D/D, D/nd1, D/nd2, nd1/nd1, nd1/nd2, nd2/nd2) are handled naturally. Dominance resolution (D > nd1 > nd2) belongs in `phenotypeResolver.js`, not the Punnett engine. | `punnettEngine.js` architecture |
| 8 | What does the CR/prl locus look like in the DOM for each combination? | **RESOLVED** the locus uses literal allele symbols in the result string. Confirmed: `n / n` (non-carrier, Knabstrupper), `CR / n` (single cream, Quarter Horse). Pattern is consistent; all remaining combinations follow the same notation: `prl / n`, `CR / prl`, `CR / CR`, `prl / prl`. No special-casing needed  split on `" / "` and take tokens as-is. Same QH sample also confirms: Champagne heterozygous = `CH / ch`; nd2 shows explicitly (`nd2 / nd2`) across a second breed. | `genotypeParser.js` |
| 9 | What counts as "fully tested" for a horse to be pickable? | **RESOLVED** a horse is unpickable only if every gene shows `?/?` (completely untested). Partially tested horses are pickable but display a "not fully tested" flag on their pairing card; untested loci are excluded from calculation and the engine runs on whatever alleles are known. Partial testing is expected and normal (e.g. players often skip Grey on Norikers). When tests are completed later, the user visits the horse's page and hits the Update button (context-aware version of Pick) to refresh genotype, photo, and name across all pairings that horse appears in. See 5.4. | Phase 3 UX + engine |
| 10 | How does the A+/At toggle work within the Agouti locus? | **RESOLVED** the toggle is per-allele slot, constrained by what that slot tested as. `A` is ambiguous (could be A, A+, or At) → dropdown per slot: [A \| A+ \| At]. `a` is unambiguous → locked, no dropdown. Examples: `A / a` → one dropdown, second slot locked. `A / A` → two independent dropdowns. `a / a` → no dropdowns. The user cannot introduce an allele that contradicts the test (e.g. cannot put `a` into a slot that tested as `A`). Parser stores raw DOM tokens; the hidden gene panel resolves each `A` slot → A/A+/At at calculation time. | Phase 5 hidden gene panel + `genotypeParser.js` |
| 11 | Photo storage strategy  URL reference or data? | **RESOLVED** store the URL string only, not the image data. Storage cost is negligible. The extension fetches and renders the image from the URL at display time. Old system horses are WIP precisely because their "photo" is not one URL but a stack of layer URLs (base coat, mane, white markings, etc.)  there is no single image to reference. New system horses have a single flat image URL. See Q13. | Phase 3 architecture |
| 12 | Can a single horse slot be cleared without deleting the whole pairing? | **RESOLVED**  yes, individual slots are replaceable. Three related pairing management actions confirmed: (1) clear/replace a single slot without affecting the other; (2) duplicate an existing pairing; (3) select a horse directly from an existing pairing card to add to a different pairing or create a new one  so the user never has to navigate back to a horse's profile page just to reuse them. | Phase 3 UX |
| 13 | How does `content.js` detect old vs new art system for photo capture? | **RESOLVED**  both systems use a `<figure>` containing `<img>` tags. The background image (`assets.horsereality.com/c/backgrounds/`) is always present and excluded. After filtering it out: **new system** = one remaining `<img>` with a `horse-img.horsereality.com` URL (single flat composite); **old system** = multiple remaining `<img>` tags with `horsereality.com/upload/colours/` and `/upload/whites/` URLs (separate layers for body, tail, mane, whites). Detection: count non-background `<img>` tags inside `<figure>`  one = new, more than one = old. Old system stores a placeholder; the Update button handles replacement after migration. | Phase 3 photo capture |

---
