# PhactoryRx

A mobile-first medication-label reference, interaction-label review, and pharmacology study notebook PWA designed by Tech Phactory Solutions LLC.

**Tagline:** Medication labels, interaction clues, and pharmacology notes.

## What it does

- Searches RxNorm public medication naming data through the U.S. National Library of Medicine.
- Loads public FDA drug-label sections through openFDA.
- Adds medications, vitamins, supplements, food cues, or custom typed items into an interaction set.
- Provides an **Interaction** tab that compares 2+ selected items pair-by-pair.
- Extracts listed public-label text for direct pair mentions, combined-condition language, possible outcomes, food/vitamin/supplement cues, contraindications, warnings, and risk-factor language.
- Saves private study notes in the browser through LocalStorage.
- Exports/imports your notebook and session interaction set as JSON.
- Installs as a PWA on supported mobile browsers.

## Interaction tab behavior

The interaction tab is a public-label analyzer, not a clinical decision-support engine. It:

1. Pulls returned openFDA label sections for each selected item.
2. Builds every pair combination from the selected interaction set.
3. Searches each item label for the other item name, generic/brand/substance terms, and relevant vitamin/food/supplement cues.
4. Displays supporting snippets, possible outcome signals mentioned in the returned text, and risk-factor language.

Absence of a direct mention does **not** prove a combination is safe. Public label data varies by manufacturer, product, ingredient, route, and dosage form.

## What it does not do

This is not a clinical decision-support system. It does not diagnose, prescribe, adjust dosage, determine real drug-drug interaction severity, or replace a pharmacist, physician, official prescribing information, poison control center, emergency services, or professional clinical interaction software.

RxNav's old drug-drug interaction feature was discontinued, so this app intentionally does not fake a black-box clinical interaction checker. It provides FDA label-text review only.

## Data sources

- RxNorm/RxNav APIs: `https://rxnav.nlm.nih.gov/REST`
- openFDA drug label API: `https://api.fda.gov/drug/label.json`

The app has no backend, no secrets, and no API keys.

## GitHub Pages deployment

1. Upload these files to a GitHub repository.
2. Go to **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select the `main` branch and `/root` folder.
5. Save, then wait for GitHub Pages to publish the site.

## Safety / privacy

- Personal notes stay in the browser unless you export them.
- Do not store protected health information if you plan to share the device, browser profile, or exported notebook file.
- Public API requests may include the drug, vitamin, supplement, or food terms you search.
- No passwords, tokens, API keys, or environment variables are included.

## Local testing

Open `index.html` directly, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## NLM attribution

This product uses publicly available data from the U.S. National Library of Medicine, National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.
