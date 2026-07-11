# PhactoryRx

PhactoryRx is a mobile-first medication lookup, official-label reference, interaction-label review, and private pharmacology notebook PWA designed by Tech Phactory Solutions LLC.

## App layout

Three self-contained tabs under a sticky tab bar:

- **Lookup** — search RxNorm, choose the correct ingredient or exact formulation, and read matched uses, description, mechanism, drug class, and expandable official label sections.
- **Interactions** — build a set of 2–10 items (add medications from Lookup, or type anything: vitamins, grapefruit, alcohol, caffeine…), then compare each pair against returned public FDA label text.
- **Notebook** — private local notes per saved item, with JSON export/import.

Status messages appear in the sticky bar so they are visible from any tab.

## Medication lookup

The reference workflow prioritizes accuracy over returning a result at any cost:

1. Searches RxNorm for normalized ingredients, brand names, strengths, dosage forms, and drug products.
2. Lets the user choose an ingredient for a general overview or an exact formulation for product-specific matching.
3. Resolves the selected RxCUI and related ingredient, brand, route, dosage-form, and release-form information.
4. Searches openFDA labels using exact RxCUI and exact ingredient/brand fallbacks.
5. Scores returned labels and rejects low-confidence, veterinary, unrelated, wrong-combination, wrong-route, and wrong-release-form records.
6. Automatically displays uses, description, mechanism when available, drug class, expandable label sections, and a DailyMed link when a SET ID is available.

If a reliable label match cannot be established, the app shows no description rather than presenting a likely-wrong one.

## Interaction tab

This remains a public-label analyzer, not a clinical interaction engine. Missing label text does not prove that a combination is safe. RxNav's former drug-drug interaction service was discontinued.

## Notebook and PWA features

- Saves notes locally in the browser; imports and exports notebook data as JSON.
- Preserves migration from older PhactoryRx storage keys.
- Installs as a PWA on supported browsers; includes iPhone/iPad home-screen icons.
- Contains no backend, passwords, private keys, or embedded API credentials.

## Data sources

- RxNorm/RxNav APIs: `https://rxnav.nlm.nih.gov/REST`
- openFDA drug label API: `https://api.fda.gov/drug/label.json`
- DailyMed official-label links: `https://dailymed.nlm.nih.gov/`

Public data can be incomplete, delayed, unavailable, or different between manufacturers and formulations. PhactoryRx is for education and reference only and must not be used to diagnose, prescribe, change a dose, or replace a pharmacist or physician.

## Verification scripts

```bash
python3 scripts/offline_check.py   # structural contracts (39 checks)
node scripts/tab_smoke_test.js     # runtime tab behavior (15 checks)
```

## GitHub Pages deployment

1. Upload the files in this folder to the root of a GitHub repository.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select the `main` branch and `/root` folder.
5. Save.

## Local testing

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## NLM attribution

This product uses publicly available data from the U.S. National Library of Medicine, National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.
