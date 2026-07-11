# PhactoryRx — Tabs & UI Simplification Patch

**Date:** July 11, 2026  
**Build:** PWA cache `phactoryrx-v6-tabs-ui`

## Reported issues

1. Tabs weren't working properly.
2. Design was overly complicated and clunky.

## Root causes found

The tab *mechanism* was sound; the tab *experience* was broken by four structural problems:

1. **Tab hijacking.** `selectDrug()` force-switched to Reference on every selection, and "Add typed item" switched tabs twice. Any interaction while on another tab yanked the user away — tabs appeared to "not stick."
2. **No tab was self-contained.** The interaction set list and its Analyze button lived in the *Reference* sidebar, while Run analysis and results lived in the *Interactions* tab, forcing constant ping-ponging.
3. **No scroll management + buried, non-sticky tab bar.** Tabs sat below a hero card and a search card. On a phone, tapping a tab changed content below the fold with no scroll, so it looked like nothing happened.
4. **Fragile event wiring.** One missing DOM node in `bindEvents()` would have thrown and killed *every* listener, including the tabs.

## Changes

### index.html (restructured)
- Compact header; **sticky tab bar** (Lookup / Interactions / Notebook) directly below it.
- **Global status line** lives in the sticky bar so feedback is visible from any tab.
- **Lookup tab** now contains the search form, example chips, results, and drug details.
- **Interactions tab** is self-contained: quick-add field for typed items (vitamins, grapefruit, alcohol…), the item list, Run analysis, Copy, and results — all in one place.
- **Notebook tab** unchanged functionally (notes, save, export/import, library).
- Removed: hero/marketing card, source pills, 3-step method grid, scope grid. Scope & safety text collapsed into one expandable section; NLM attribution kept visible as required.
- Removed the redundant sidebar "Analyze" button (`reviewLabelsBtn`); "Run analysis" is the single entry point.
- CSP, manifest links, template, and every element ID app.js binds are preserved (plus new `interactionAddForm` / `interactionAddInput`).

### app.js (surgical patches only — lookup/matching/interaction logic untouched)
- `selectDrug()` no longer forces a tab switch.
- `addTypedItemToMedList()` reads the new Interactions-tab input, stays on the current tab, and clears the field.
- `setActiveTab(tab, { scroll })` scrolls to top on user-initiated switches (respects `prefers-reduced-motion`); programmatic/init calls don't scroll. The interaction set's "Open" button navigates with scroll.
- `bindEvents()` rewritten with a null-safe `on()` helper — a missing node can no longer disable the whole app. `reviewLabelsBtn` usages are guarded.

### styles.css (rewritten, same brand)
- Same palette and gradient accent; flat solid panels replace glassy blur/shadows (better mobile perf), radii 16/12/9, tighter spacing, 880px column.
- Sticky `.tab-bar` with backdrop blur where supported; `.status-banner:empty` collapses.
- Every class app.js generates (summary cards, verified-label card, pair/risk/match badges, evidence blocks, chips, stack items, label sections, report classes) is preserved and restyled.
- Kept: `[hidden]` display guard, focus-visible outlines, reduced-motion block, overflow-wrap hardening from the audit.

### service-worker.js
- Cache bumped `v5` → `phactoryrx-v6-tabs-ui`. Logic unchanged. Installed copies fetch the new shell on next launch (stale-while-revalidate: the very first load after deploy may still show v5 once).

## Verification (offline sandbox)

- `scripts/offline_check.py` — **39/39 passed**: JS syntax, manifest, duplicate IDs, every app.js `#id` selector resolves, data-tab ⇄ data-panel parity, aria-controls targets, all app.js-emitted and HTML classes styled, linked assets, SW shell entries, cache bump, CSP intact, behavioral guards.
- `scripts/tab_smoke_test.js` — **15/15 passed**: executes app.js against a DOM stub built from index.html; init completes; each tab click shows exactly one panel, updates `aria-selected`, and scrolls; adding a typed item on Interactions stays on Interactions, clears the input, and posts a status.

**Limitation:** the sandbox has no browser and no network. Live RxNorm/openFDA behavior, real service-worker update flow, and iOS standalone rendering should be spot-checked on device.
