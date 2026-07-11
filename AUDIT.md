# PhactoryRx Medication Lookup Accuracy Audit

**Audit date:** July 11, 2026  
**Build:** Medication lookup accuracy repair / PWA cache v5

## User-reported issue

Some medication searches previously displayed the wrong description. The earlier lookup relied too heavily on approximate names and broad label-field searches, which could select a label for a different formulation, combination product, or similarly named item.

## Repairs completed

### Exact medication identification

- Added RxNorm `getDrugs` results so users can choose ingredient, brand, strength, dosage form, generic product, branded product, or pack.
- Added exact-or-normalized RxCUI lookup before approximate fallback.
- Increased useful search coverage while deduplicating concepts and suppressing inactive results.
- Added human-readable result types and clear guidance to choose the correct strength/formulation.

### Safer label matching

- Resolves related RxNorm ingredients, brands, routes, dosage forms, and formulation modifiers before querying labels.
- Prioritizes exact product RxCUI matches.
- Uses exact ingredient and brand fallbacks only when needed.
- Rejects veterinary/animal labels.
- Rejects combination-product labels for single-ingredient searches.
- Preserves legitimate multi-ingredient medication matching.
- Penalizes wrong route and dosage-form matches.
- Distinguishes extended-release, delayed-release, immediate-release, controlled-release, sustained-release, enteric-coated, chewable, disintegrating, and effervescent formulations.
- Refuses to display a label below the minimum confidence threshold.

### Uses and description output

- Medication labels now load automatically after selecting a search result.
- Added prominent summary cards for:
  - Uses / indications or OTC purpose
  - Description
  - Mechanism / how it works
  - Drug class
- Added additional expandable sections for purpose, description, mechanism of action, clinical pharmacology, and active ingredient.
- Added a direct DailyMed official-label link when a valid SPL SET ID is returned.
- Added a visible match explanation such as exact product RxCUI, ingredient match, or brand-name match.

### Existing systems preserved

- Interaction analysis remains operational and uses the same stricter label selection.
- Notebook save/import/export and legacy storage migration remain intact.
- PWA cache was bumped to `phactoryrx-v5-medication-lookup` so installed copies retrieve the repaired JavaScript and CSS.

## Automated tests completed

### Syntax and structural checks

- `node --check app.js`
- `node --check service-worker.js`
- Manifest JSON parse and PWA field checks
- HTML duplicate-ID and referenced-element checks
- Local linked-asset existence checks
- CSS parser validation
- PNG dimensions and format validation
- Common secret/private-key marker scan

### Deterministic API/matching tests

Mocked RxNorm and openFDA responses verified:

- ingredient and formulation results are both returned;
- a correct single-ingredient human label beats a combination label sharing the ingredient RxCUI;
- animal/veterinary labels are rejected;
- uses, description, mechanism, and pharmacologic class summaries are extracted;
- formulation fallback selects the correct single-ingredient label;
- true combination medications match combination labels and reject incomplete single-ingredient labels;
- extended-release labels outrank immediate-release labels for an extended-release selection;
- unrelated medication labels remain below the acceptance threshold.

## Test limitation

The isolated build environment could not connect directly to the live RxNorm or openFDA hosts. Network behavior was checked against the current official API documentation and exercised with deterministic mock responses. Live services may still experience outages, rate limiting, missing harmonized identifiers, or label variation.

## Safety limitation

PhactoryRx is an educational reference tool. It is not validated clinical decision-support software and does not diagnose, prescribe, recommend dosage changes, determine that a drug combination is safe, or replace official prescribing information or licensed medical professionals.
