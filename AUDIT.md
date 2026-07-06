# Audit Report

## Branding update checks

- Renamed the app from Phactory Pharmacology to **PhactoryRx**.
- Updated browser title, header branding, PWA manifest name/short name, export metadata, notebook export filename, service-worker cache name, README, and icon accessibility label.
- Preserved backward compatibility with old LocalStorage notebook keys so existing browser notes can migrate forward.

## Static checks completed

- JavaScript syntax check passed for `app.js` with `node --check`.
- Service worker syntax check passed for `service-worker.js` with `node --check`.
- Manifest JSON validation passed with `python3 -m json.tool`.
- Secret scan checked for common API key/password/token markers. No credential values, API keys, passwords, authorization headers, or bearer tokens were found.
- App is static-only: HTML, CSS, JavaScript, manifest, service worker, and SVG icon.

## New interaction-tab checks

- Added a dedicated Interactions tab.
- Added manual typed-item support for vitamins, supplements, grapefruit, alcohol, caffeine, food cues, or non-RxNorm items.
- Added pairwise analysis for 2+ selected items.
- Added extraction of direct pair mentions from returned label sections.
- Added food/vitamin/supplement cue extraction.
- Added possible-outcome and risk-factor signal extraction from public label text.
- Added copyable interaction report output.
- Preserved educational-only medical safety wording.

## Security posture

- No backend server.
- No environment variables.
- No embedded credentials.
- No third-party JavaScript libraries.
- No `eval` or dynamic script loading.
- Content Security Policy restricts scripts/styles to local files and allows network calls only to public medication-data endpoints.

## Medical safety posture

- The app labels itself as educational/reference-only.
- It avoids pretending to provide clinical drug-drug interaction severity.
- It clearly explains that RxNav's drug-drug interaction feature was discontinued and uses public label text review instead.
- It does not provide individualized medical advice, diagnosis, prescribing decisions, or dosage recommendations.
- Interaction analysis reports supporting snippets and signal language instead of issuing medical instructions.

## Known limits

- Public API availability and rate limits can affect lookups.
- openFDA labels vary by manufacturer/product and may not include every section for every drug.
- Manual supplement/food items may not have matching FDA drug labels.
- Absence of a direct pair mention does not prove safety.
- LocalStorage notes stay only on the current browser/device unless exported.

## Latest static validation after PhactoryRx rename

- `node --check app.js` passed.
- `node --check service-worker.js` passed.
- `python3 -m json.tool manifest.webmanifest` passed.
- Duplicate HTML ID check passed.
- Required app element ID check passed.
- Secret-marker scan found only false positives from words such as `risk-badge` and documentation statements saying no secrets/passwords are included; no credential values, API keys, bearer tokens, or authorization headers were found.
