# Phenotype Resolver | Rules & Objectives

> Companion to [`planning.md`](./planning.md). This doc describes what the resolver should *do*, the rules of horse colour, in the order they apply, and the user-facing behaviour.

---

## Why this exists

Horse Reality shows you raw genotypes, `E: E/e · A: A/a · CR: CR/n · D: D/nd2`, and nothing else. To know what coat that adds up to ("Buckskin Dun"), you have to either know horse genetics by heart or cross-reference a wiki.

The resolver translates a genotype into a readable colour name using a set of rules with an override hierarchy. This avoids manually mapping each combination manually. It runs entirely in the user's browser, processing every offspring outcome produced by the Punnett engine. Players see the colour name alongside the percentage and genotype.

It should use standard equine-genetics terminology. Players that either know or are learning genetics from real-world references will recognize it.

**Guiding principle:** the resolver names the *visible* coat colour, not the genotype. Carried-but-hidden alleles (a silver-carrier chestnut, a chestnut carrying At, etc.) are invisible to the resolver, the genotype column already shows them. When a later rule masks an earlier one (Grey wiping the base colour, Cream double-diluting under Champagne), only the visible result is named.

---

## What the resolver produces, per outcome

For each offspring genotype, the resolver returns:

- **A colour name**, *"Bay Dun"*, *"Silver Black"*, *"Cremello"*, *"Sooty Buckskin"*, *"Grey"*. One readable string.
- **A list of white-pattern overlays**, *Tobiano*, *Roan*, *Rabicano*, *Frame Overo*, *Leopard*, etc. These layer on top of the colour, they don't replace it.
- **A lethal flag**, `true` if the genotype is unviable (OLW/OLW or any homozygous Wx except W20/W20).
- **Optional notes**, short context strings the UI can show as tooltips or footnotes: *"Roan only shows from age 3"*, *"Grey overrides all colour at adulthood"*, *"Primitive markings (nd1) without dun dilution"*.

A horse can therefore display as *"Bay Dun · Tobiano · Rabicano"* with a *"Roan shows from age 3"* note, and that's the whole interpretation.

---

## How the rules apply (override hierarchy)

Genes are applied in a strict order. Every rule operates on the colour name produced by the previous rule. A later rule can override the visible result of an earlier one. White patterns are layered separately and never replace the base colour.

### 1. Base colour | Extension (E) and Agouti (A)

Black pigment is defined by Extension. Without it, the horse is chestnut and Agouti has no visual effect (though chestnuts still pass A alleles to offspring).

If `e/e`, the horse is **Chestnut** regardless of Agouti.

Otherwise (`E/E` or `E/e`), the horse expresses whichever Agouti allele has the highest priority of its two copies. Priority: `A+ > A > At > a`.

- `A+/A+`, `A+/A`, `A+/At`, `A+/a`, `A/A+`→ **Wild Bay**
- `A/A`, `A/At`, `A/a` → **Bay**
- `At/At`, `At/A`, `At/a` → **Seal Brown**
- `a/a` → **Black**

The lower-priority allele is still inherited and passed to offspring 50% of the time, even when not visible. So `A/At` looks bay but its foals can still inherit At, `At/a` looks seal brown but can still throw a black foal when paired with another `_/a` horse.

Agouti slot ambiguity is resolved upstream by the hidden gene panel: the user picks A+/At for any ambiguous "A" slot before the resolver sees the genotype.

### 2. Cream and Pearl

Cream and Pearl share a locus, a horse carries at most two alleles between the two genes combined. Their interaction is dosage-sensitive.

| State | Effect on the base colour |
|---|---|
| `CR/n` (single cream) | Chestnut → Palomino · Bay → Buckskin · Wild Bay → Wild Bay Buckskin · Seal Brown → Seal Buckskin · Black → Smoky Black |
| `CR/CR` or `CR/prl` (double dilute) | Chestnut → Cremello · Bay → Perlino · Wild Bay → Wild Bay Perlino · Seal Brown → Seal Perlino · Black → Smoky Cream |
| `prl/prl` (double pearl) | Adds *"Pearl"* in front of the base name (Pearl Chestnut, Pearl Bay, Pearl Black, etc.) |
| `prl/n` or `n/n` | No visible effect |

### 3. Champagne

Champagne is dominant and stacks with Cream. It dilutes both red and black pigment with a characteristic warm tone.

- Chestnut + CH → **Gold Champagne**
- Bay + CH → **Amber Champagne**
- Seal Brown + CH → **Sable Champagne**
- Black + CH → **Classic Champagne**
- Already-creamed coats stack: Palomino + CH → Gold Cream Champagne, Buckskin + CH → Amber Cream Champagne, Smoky Black + CH → Classic Cream Champagne
- Already-double-diluted coats (Cremello, Perlino, etc.), Champagne is masked, no name change

### 4. Silver

Silver dilutes black pigment only. Chestnut, Palomino, Cremello and other purely-red coats carry it silently, there's nothing visible to dilute. The carrier status shows in the genotype column, we don't repeat it in the colour name.

- Black → **Silver Black**
- Bay → **Silver Bay**
- Wild Bay → **Silver Wild Bay**
- Seal Brown → **Silver Seal Brown**
- Buckskin → **Silver Buckskin**
- Smoky Black → **Silver Smoky Black**

### 5. Mushroom

Mushroom is recessive (needs `mu/mu`) and only affects red pigment. On chestnut it produces a sepia colour with a characteristic light mane and tail; on bay-based coats, it tones the red parts.

- Chestnut → **Mushroom**
- Palomino → **Mushroom Palomino**
- Bay / Buckskin → **Mushroom Bay** / **Mushroom Buckskin**
- Black, Seal Brown, and their derivatives, no effect

### 6. Dun

Dun is dominant. A single copy of D adds body dilution and primitive markings (dorsal stripe, leg barring, frosting, face mask) to whatever colour came before it.

- `D/_` → append *" Dun"* (Bay Dun, Palomino Dun, Silver Black Dun, Smoky Cream Dun)
- `nd1/_` without D → primitive markings only, no dilution. The colour name stays unchanged but the resolver pushes a *"primitive markings (nd1)"* note for the UI to show.
- `nd2/nd2` → no effect

### 7. Flaxen

Flaxen is recessive (needs `f/f`) and only changes red-based manes and tails to a lighter, almost-blond shade. It has no visible effect on coats without red pigment in the mane.

- Chestnut → **Flaxen Chestnut**
- Palomino → **Flaxen Palomino**
- Gold Champagne → **Flaxen Gold Champagne**
- Bay-based coats, Black, double dilutes, Mushroom, no effect

### 8. Sooty

Sooty darkens a coat with smutty shading. It's the messiest rule, dominance varies by base colour and breed.

- **Bay-based coats** (Bay, Wild Bay, Seal Brown, Buckskin, Seal Buckskin, Amber Champagne, Sable Champagne): a single STY copy shows. Treat as dominant.
- **Chestnut-based coats** (Chestnut, Palomino, Gold Champagne) in most breeds: two copies needed. Treat as recessive.
- **Lusitano, Trakehner, Oldenburg, Haflinger** treat Sooty as incomplete dominant on chestnut, STY/n and STY/STY produce visibly different shades. v1 flattens both into a single *"Sooty"* prefix; can be split later if users care.
- **Black** never expresses Sooty regardless of copy count. The gene is there but masked completely.
- **Masked by:** Grey (which overrides everything anyway), Dun (in every breed except Kathiawari, where sooty dun *is* a real phenotype), and any double dilute (`CR/CR`, `CR/prl`, `prl/prl`, `mu/mu`).

**Naming when applied:**

- **Chestnut + STY/STY → Liver Chestnut**
- **Flaxen Chestnut + STY/STY → Liver Flaxen Chestnut**
- Every other base, prefix with *"Sooty "* (Sooty Bay, Sooty Buckskin, Sooty Bay Dun, Sooty Palomino, Sooty Gold Champagne, Sooty Amber Champagne, etc.). Sooty stacks on whatever colour name survived all earlier dilution rules.

### 9. Pangaré

Pangaré lightens the belly, muzzle, eye area, flanks, and inside of the legs. It's dominant and only affects red, bay, and seal-based bases, never black.

- Chestnut / Palomino / Gold Champagne / Mushroom Chestnut → prefix **Pangaré**
- Bay / Buckskin / Amber Champagne → prefix **Pangaré**
- Seal Brown / Seal Buckskin / Sable Champagne → prefix **Pangaré**
- Black, Smoky Black, and their dilutes, no effect

### 10. Grey overrides everything

Grey is the last rule. A single copy is enough, `G/G` or `G/n` both turn the adult coat grey, regardless of every preceding step.

When grey applies, the resolver throws away the carefully-built colour name and replaces it with **Grey**. The underlying genotype still shows in the genotype column for anyone who wants the detail.

The resolver only emits the Grey note (*"Grey overrides all colour at adulthood, foal shows base colour"*). All other modifier notes (nd1 primitive markings, Roan age-3, etc.) are dropped, since the visible coat is grey.

White-pattern overlays (Tobiano, Frame, etc.) still apply on top of Grey, they are visible during the foal phase and on early-grey adults, so they belong in the patterns list regardless.

In-game, the adult grey phenotype is randomly chosen from a breed-specific pool (dapple grey, steel grey, fleabitten, white, etc.).

### 11. White patterns

Patterns are listed separately from the base colour, in any order. They overlay rather than rename. The same horse can carry several at once.

- **Tobiano**, `TO/_`. Vertical white patches that cross the topline.
- **Frame Overo**, `OLW/_`. Horizontal white that doesn't usually cross the back. **Lethal when homozygous**, see below.
- **Roan**, `RN/_`. White hairs interspersed with the base colour. Push a note: *"Roan shows from age 3 in-game"*.
- **Sabino 1**, `SB1/_`. Single copy gives bold high white markings; homozygous (`SB1/SB1`) often produces nearly all-white horses.
- **Splashed White 1/3**, `SW1/_` or `SW3/_` on the MITF locus.
- **Splashed White 2**, `SW2/_`.
- **Dominant Whites**, `W3, W8, W10, W16, W19, W20, W21` and any other Wx-series. Use the locus name as the pattern label (*"KIT-W3"*, etc.). All homozygous combinations except `W20/W20` are lethal.
- **Hidden Sabino**, `Y/Y` (recessive in most breeds; user-asserted via the hidden gene panel).
- **Rabicano**, `rb/rb` (recessive, user-asserted). Subtle white at the flanks and tail.
- **White Markings**, `WM/_`. Controls the *size* of face and leg markings rather than producing its own pattern. Show as *"White Markings"* in the pattern list when present.
- **Appaloosa (Leopard Complex)**, see next section.

### 12. Appaloosa pattern composition

Leopard (LP) interacts with PATN1 and PATN2 to produce the visible Appaloosa pattern. LP must be present for any PATN modifier to have a visible effect.
The dosage of LP combined with pattern modifiers determines the expressed phenotype. LP also produces striped hooves and visible white sclera. PATN2 is untestable and may therefore be the reason why a horse that tests negative for PATN1, still shows a spotted blanket or snowcap blanket pattern.

- No LP (`lp/lp`) → No Appaloosa pattern, even if PATN modifiers are present.

- Without PATN modifiers:
  - `LP/lp` or `LP/LP` → Varnish Roan (roan-like progressive pattern, also appears at age 3 in HR)

- With PATN1:
  - `LP/lp` + `PATN1/patn1` → Near Leopard
  - `LP/lp` + `PATN1/PATN1` → Leopard
  - `LP/LP` + `PATN1/patn1` → Near Few-Spot
  - `LP/LP` + `PATN1/PATN1` → Few-Spot Leopard

- With PATN2 (no PATN1):
  - `LP/lp` + PATN2 → Spotted Snowcap Blanket
  - `LP/LP` + PATN2 → White Snowcap Blanket


---

**Resolver rule:**  
Show as a single overlay phenotype name. Possible outputs: *"Varnish Roan"*, *"Near Leopard"*, *"Leopard"*, *"Near Few-Spot"*, *"Few-Spot Leopard"*, *"Spotted Snowcap Blanket"*, *"White Snowcap Blanket"*. Don't list LP / PATN1 / PATN2 as separate entries.

---
### 13. Lethal combinations

A genotype is lethal when:

- `OLW/OLW`, Frame Overo homozygous. Foals are born with a lethal intestinal defect (Overo Lethal White Syndrome).
- Any homozygous Wx-series allele **except** `W20/W20`. These cause embryonic lethality (failed cover, no foal).

For lethal outcomes the resolver returns the colour name as **"Lethal White"** (community-standard term) and sets the lethal flag. The UI keeps the row in the table but tags it with the existing lethal styling.

---

## What the user actually sees

A row in the offspring table currently shows:

```
Genotype                                    | %
E: E/e · A: A/a · CR: CR/n · D: D/nd2 · TO: TO/n  |  12.5%
```

After the resolver, the same row becomes:

```
Genotype                                          | Phenotype               | %
E: E/e · A: A/a · CR: CR/n · D: D/nd2 · TO: TO/n  | Buckskin Dun · Tobiano  |  12.5%
```

A row tagged lethal:

```
E: ... · OLW: OLW/OLW                       | Lethal White [lethal] |  6.25%
```

A row with grey:

```
E: E/e · A: A/a · G: G/n · ...              | Grey *                |  25%
```
(`*` reveals the *"Grey overrides all colour at adulthood, foal shows base colour"* note.)

---

## Things I deliberately leave out of v1

- **Predicting which grey phenotype a horse becomes at adulthood.** The pool is breed-specific and randomized in-game, outside the scope of the resolver.
- **Foal-age coats vs adult coats** other than the Grey / Roan notes. The resolver always returns the adult phenotype.
- **Pinto pattern interaction maths.** When Tobiano, Frame, and Sabino combine, each pattern is listed independently.
- **Anything that requires a network call.** The whole resolver runs locally in the browser, like the rest of the extension.