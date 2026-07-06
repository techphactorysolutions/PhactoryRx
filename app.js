'use strict';

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA_LABEL = 'https://api.fda.gov/drug/label.json';
const STORAGE_KEY = 'phactoryrx-v1';

const LABEL_FIELDS = [
  ['boxed_warning', 'Boxed Warning'],
  ['indications_and_usage', 'Indications & Usage'],
  ['contraindications', 'Contraindications'],
  ['warnings', 'Warnings'],
  ['warnings_and_cautions', 'Warnings & Cautions'],
  ['adverse_reactions', 'Adverse Reactions'],
  ['drug_interactions', 'Drug Interactions'],
  ['dosage_and_administration', 'Dosage & Administration'],
  ['use_in_specific_populations', 'Use in Specific Populations'],
  ['overdosage', 'Overdosage']
];

const INTERACTION_FIELDS = [
  ['drug_interactions', 'Drug Interactions'],
  ['drug_and_or_laboratory_test_interactions', 'Drug/Lab Test Interactions'],
  ['contraindications', 'Contraindications'],
  ['boxed_warning', 'Boxed Warning'],
  ['warnings', 'Warnings'],
  ['warnings_and_cautions', 'Warnings & Cautions'],
  ['precautions', 'Precautions'],
  ['adverse_reactions', 'Adverse Reactions'],
  ['use_in_specific_populations', 'Use in Specific Populations'],
  ['pregnancy', 'Pregnancy'],
  ['nursing_mothers', 'Nursing Mothers'],
  ['pediatric_use', 'Pediatric Use'],
  ['geriatric_use', 'Geriatric Use'],
  ['ask_doctor', 'Ask Doctor'],
  ['ask_doctor_or_pharmacist', 'Ask Doctor or Pharmacist'],
  ['do_not_use', 'Do Not Use'],
  ['stop_use', 'Stop Use'],
  ['overdosage', 'Overdosage']
];

const OUTCOME_RULES = [
  { label: 'Contraindicated / do not combine', pattern: /\b(contraindicated|do not use|must not be used|should not be used|avoid concomitant|avoid concurrent|not recommended)\b/i, severity: 3 },
  { label: 'Increased exposure or effect', pattern: /\b(increase[sd]?|increasing|elevated|higher|potentiate[sd]?|enhance[sd]?|greater)\b.{0,80}\b(concentration|exposure|effect|levels?|risk|toxicity|bleeding|sedation)\b/i, severity: 2 },
  { label: 'Reduced or negated effect', pattern: /\b(decrease[sd]?|decreasing|reduce[sd]?|reduced|lower|diminish(?:ed)?|loss of efficacy|less effective|impair(?:ed)? absorption|inhibit(?:ed)? absorption)\b/i, severity: 2 },
  { label: 'Bleeding risk', pattern: /\b(bleeding|hemorrhage|haemorrhage|anticoagulant|warfarin|platelet|INR)\b/i, severity: 2 },
  { label: 'Heart rhythm / QT risk', pattern: /\b(QT|torsades|arrhythmia|cardiac rhythm|heart rhythm|bradycardia|tachycardia)\b/i, severity: 3 },
  { label: 'Serotonin / CNS risk', pattern: /\b(serotonin syndrome|serotonergic|CNS depression|central nervous system depression|respiratory depression|sedation|somnolence)\b/i, severity: 3 },
  { label: 'Blood pressure or glucose change', pattern: /\b(hypotension|hypertension|blood pressure|hypoglycemia|hyperglycemia|blood glucose)\b/i, severity: 2 },
  { label: 'Kidney / liver concern', pattern: /\b(renal|kidney|hepatic|liver|nephrotoxicity|hepatotoxicity)\b/i, severity: 2 },
  { label: 'Monitor or adjust therapy', pattern: /\b(monitor|dose adjustment|adjust(?:ment)?|caution|carefully|clinical monitoring)\b/i, severity: 1 }
];

const RISK_FACTOR_RULES = [
  { label: 'Pregnancy or breastfeeding', pattern: /\b(pregnan(?:cy|t)|fetal|fetus|lactation|breastfeeding|nursing mothers?)\b/i },
  { label: 'Pediatric or geriatric patient', pattern: /\b(pediatric|children|child|geriatric|elderly|older adults?)\b/i },
  { label: 'Renal impairment', pattern: /\b(renal impairment|kidney disease|kidney impairment|creatinine|dialysis)\b/i },
  { label: 'Hepatic impairment', pattern: /\b(hepatic impairment|liver disease|liver impairment|cirrhosis)\b/i },
  { label: 'Heart rhythm or cardiac disease', pattern: /\b(QT prolongation|arrhythmia|heart disease|cardiac disease|heart failure|myocardial infarction)\b/i },
  { label: 'Bleeding disorder / anticoagulants', pattern: /\b(bleeding disorder|anticoagulant|warfarin|heparin|platelet|ulcer|hemorrhage)\b/i },
  { label: 'Electrolyte or dehydration issue', pattern: /\b(electrolyte|potassium|magnesium|dehydration|volume depletion)\b/i },
  { label: 'Alcohol / grapefruit / food timing', pattern: /\b(alcohol|grapefruit|food|meal|fasting|dairy|milk)\b/i },
  { label: 'Allergy or hypersensitivity', pattern: /\b(allergy|hypersensitivity|anaphylaxis|allergic)\b/i }
];

const SUPPLEMENT_LIKE_PATTERN = /\b(vitamin|mineral|supplement|calcium|iron|magnesium|zinc|potassium|folic|folate|ascorbic|cholecalciferol|cyanocobalamin|cobalamin|niacin|thiamine|riboflavin|biotin|omega|fish oil|st\.?\s*john|herbal|botanical|grapefruit|caffeine|alcohol)\b/i;
const FOOD_SUPPLEMENT_CUE_TERMS = ['vitamin', 'vitamin k', 'calcium', 'iron', 'magnesium', 'zinc', 'potassium', 'folate', 'folic acid', 'food', 'meal', 'dairy', 'milk', 'grapefruit', 'alcohol', 'caffeine', 'antacid', 'St. John', 'herbal', 'supplement'];
const TERM_STOPWORDS = new Set(['oral', 'tablet', 'capsule', 'solution', 'injection', 'cream', 'ointment', 'gel', 'spray', 'patch', 'suspension', 'drug', 'acid', 'sodium', 'hydrochloride', 'hcl', 'extended', 'release', 'delayed', 'the', 'and', 'with', 'for']);

const dom = {
  installBtn: document.querySelector('#installBtn'),
  drugSearchForm: document.querySelector('#drugSearchForm'),
  drugSearchInput: document.querySelector('#drugSearchInput'),
  clearAllBtn: document.querySelector('#clearAllBtn'),
  manualAddBtn: document.querySelector('#manualAddBtn'),
  statusBanner: document.querySelector('#statusBanner'),
  searchResults: document.querySelector('#searchResults'),
  resultTemplate: document.querySelector('#resultTemplate'),
  drugDetail: document.querySelector('#drugDetail'),
  saveDrugBtn: document.querySelector('#saveDrugBtn'),
  medList: document.querySelector('#medList'),
  reviewLabelsBtn: document.querySelector('#reviewLabelsBtn'),
  interactionReview: document.querySelector('#interactionReview'),
  copyReviewBtn: document.querySelector('#copyReviewBtn'),
  runInteractionBtn: document.querySelector('#runInteractionBtn'),
  studyNotes: document.querySelector('#studyNotes'),
  saveNotesBtn: document.querySelector('#saveNotesBtn'),
  savedLibrary: document.querySelector('#savedLibrary'),
  exportBtn: document.querySelector('#exportBtn'),
  importBtn: document.querySelector('#importBtn'),
  importFile: document.querySelector('#importFile'),
  tabBtns: Array.from(document.querySelectorAll('[data-tab]')),
  tabPanels: Array.from(document.querySelectorAll('[data-panel]'))
};

const appState = {
  selected: null,
  searchResults: [],
  medList: [],
  library: {},
  labelCache: new Map(),
  lastReviewText: '',
  deferredInstallPrompt: null
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('phactory-pharmacology-v2') || localStorage.getItem('phactory-pharmacology-v1');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    appState.library = parsed.library && typeof parsed.library === 'object' ? parsed.library : {};
    appState.medList = Array.isArray(parsed.medList) ? parsed.medList : [];
  } catch (error) {
    console.warn('Could not load local state.', error);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    library: appState.library,
    medList: appState.medList.slice(0, 20)
  }));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function truncate(value, max = 1100) {
  const text = normalizeWhitespace(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function sectionText(labelRecord, key, max = 1600) {
  const raw = labelRecord?.[key];
  if (!raw) return '';
  const joined = Array.isArray(raw) ? raw.join('\n\n') : String(raw);
  return truncate(joined, max);
}

function rawSectionText(labelRecord, key, max = 6000) {
  const raw = labelRecord?.[key];
  if (!raw) return '';
  const joined = Array.isArray(raw) ? raw.join(' ') : String(raw);
  return truncate(joined, max);
}

function setStatus(message = '', variant = '') {
  dom.statusBanner.textContent = message;
  dom.statusBanner.className = `status-banner ${variant}`.trim();
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeout ?? 16000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (response.status === 404) return null;
    if (response.status === 429) {
      throw new Error('The public data source is rate-limiting requests. Try again later.');
    }
    if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getRxProperties(rxcui) {
  if (!rxcui || String(rxcui).startsWith('custom:')) return null;
  const url = `${RXNAV_BASE}/rxcui/${encodeURIComponent(rxcui)}/properties.json`;
  const json = await fetchJson(url);
  return json?.properties ?? null;
}

async function searchRxNorm(term) {
  const url = `${RXNAV_BASE}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=8`;
  const json = await fetchJson(url);
  const candidates = json?.approximateGroup?.candidate ?? [];
  const unique = [];
  const seen = new Set();

  for (const candidate of candidates) {
    if (!candidate.rxcui || seen.has(candidate.rxcui)) continue;
    seen.add(candidate.rxcui);
    unique.push(candidate);
  }

  const hydrated = await Promise.all(unique.map(async (candidate) => {
    try {
      const properties = await getRxProperties(candidate.rxcui);
      return {
        rxcui: candidate.rxcui,
        score: candidate.score,
        rank: candidate.rank,
        name: candidate.name || properties?.name || `RxCUI ${candidate.rxcui}`,
        tty: properties?.tty || 'Unknown type',
        synonym: properties?.synonym || '',
        language: properties?.language || '',
        suppress: properties?.suppress || '',
        properties
      };
    } catch (error) {
      return {
        rxcui: candidate.rxcui,
        score: candidate.score,
        rank: candidate.rank,
        name: candidate.name || `RxCUI ${candidate.rxcui}`,
        tty: 'Unknown type',
        synonym: '',
        language: '',
        suppress: '',
        properties: null
      };
    }
  }));

  return hydrated;
}

function labelSearchTerms(drugOrTerm) {
  const raw = typeof drugOrTerm === 'string' ? drugOrTerm : (drugOrTerm?.name || '');
  const cleaned = raw
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?|%)\b/gi, ' ')
    .replace(/\b(oral|tablet|capsule|solution|suspension|injection|extended release|delayed release|topical|cream|ointment|gel|spray|aerosol|powder|film|patch|syrup|chewable|sublingual|intravenous|intramuscular|subcutaneous)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const firstToken = cleaned.split(/[\s/,-]+/).filter(Boolean)[0] || raw.split(/[\s/,-]+/).filter(Boolean)[0] || raw;
  return Array.from(new Set([raw, cleaned, firstToken].map((term) => String(term).trim()).filter((term) => term.length >= 3)));
}

function makeOpenFdaQuery(term) {
  const safe = String(term).replace(/"/g, '').trim();
  return `(openfda.generic_name:"${safe}" OR openfda.brand_name:"${safe}" OR openfda.substance_name:"${safe}")`;
}

async function searchOpenFdaLabels(term) {
  const terms = labelSearchTerms(term);

  for (const candidate of terms) {
    const primaryUrl = `${OPENFDA_LABEL}?search=${encodeURIComponent(makeOpenFdaQuery(candidate))}&limit=5`;
    const primary = await fetchJson(primaryUrl);
    if (primary?.results?.length) return primary.results;
  }

  for (const candidate of terms) {
    const fallbackUrl = `${OPENFDA_LABEL}?search=${encodeURIComponent(candidate)}&limit=5`;
    const fallback = await fetchJson(fallbackUrl);
    if (fallback?.results?.length) return fallback.results;
  }

  return [];
}

function bestLabelMeta(label) {
  const fda = label?.openfda ?? {};
  const brand = Array.isArray(fda.brand_name) ? fda.brand_name[0] : '';
  const generic = Array.isArray(fda.generic_name) ? fda.generic_name[0] : '';
  const manufacturer = Array.isArray(fda.manufacturer_name) ? fda.manufacturer_name[0] : '';
  const route = Array.isArray(fda.route) ? fda.route.join(', ') : '';
  return { brand, generic, manufacturer, route };
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'item';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isUsableTerm(term) {
  const cleaned = normalizeWhitespace(term).toLowerCase();
  if (cleaned.length < 3) return false;
  if (/^\d+$/.test(cleaned)) return false;
  if (TERM_STOPWORDS.has(cleaned)) return false;
  if (cleaned === 'vitamin') return false;
  return true;
}

function buildSearchTermsFromText(value) {
  const base = labelSearchTerms(value)
    .flatMap((term) => {
      const words = term.split(/[\s,/()+-]+/).filter(Boolean);
      return [term, ...words];
    })
    .map((term) => normalizeWhitespace(term))
    .filter(isUsableTerm);
  return Array.from(new Set(base)).slice(0, 16);
}

function labelTerms(label) {
  const fda = label?.openfda ?? {};
  const values = [
    ...toArray(fda.generic_name),
    ...toArray(fda.brand_name),
    ...toArray(fda.substance_name),
    ...toArray(label?.active_ingredient)
  ];
  return values.flatMap(buildSearchTermsFromText);
}

function reportTerms(drug, label) {
  const values = [drug?.name || '', drug?.synonym || '', ...labelTerms(label)];
  return Array.from(new Set(values.flatMap(buildSearchTermsFromText))).slice(0, 24);
}

function splitSentences(text) {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];
  return clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
}

function sentenceHasTerm(sentence, term) {
  const cleanSentence = normalizeWhitespace(sentence).toLowerCase();
  const cleanTerm = normalizeWhitespace(term).toLowerCase();
  if (!isUsableTerm(cleanTerm)) return false;
  if (cleanTerm.includes(' ')) return cleanSentence.includes(cleanTerm);
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(cleanTerm)}([^a-z0-9]|$)`, 'i');
  return pattern.test(cleanSentence);
}

function uniqueList(items, max = 8) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const clean = truncate(item, 480);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
    if (output.length >= max) break;
  }
  return output;
}

function extractSnippets(text, terms, max = 8) {
  const sentences = splitSentences(text);
  const matches = [];
  for (const sentence of sentences) {
    if (terms.some((term) => sentenceHasTerm(sentence, term))) matches.push(sentence);
  }
  return uniqueList(matches, max);
}

function detectRuleLabels(text, rules) {
  const labels = [];
  for (const rule of rules) {
    if (rule.pattern.test(text)) labels.push(rule.label);
  }
  return Array.from(new Set(labels));
}

function highestSeverity(text) {
  return OUTCOME_RULES.reduce((max, rule) => rule.pattern.test(text) ? Math.max(max, rule.severity || 1) : max, 0);
}

function isSupplementLike(drug) {
  return SUPPLEMENT_LIKE_PATTERN.test(drug?.name || '');
}

async function getLabelReport(drug) {
  const cacheKey = `${drug.rxcui || ''}:${drug.name}`.toLowerCase();
  if (appState.labelCache.has(cacheKey)) return appState.labelCache.get(cacheKey);

  const labels = await searchOpenFdaLabels(drug.name);
  const label = labels[0] || null;
  const meta = label ? bestLabelMeta(label) : { brand: '', generic: '', manufacturer: '', route: '' };
  const sections = {};

  if (label) {
    for (const [key, title] of INTERACTION_FIELDS) {
      const text = rawSectionText(label, key, 6000);
      if (text) sections[key] = { title, text };
    }
  }

  const report = {
    drug,
    label,
    meta,
    terms: reportTerms(drug, label),
    sections,
    allSafetyText: Object.values(sections).map((section) => `${section.title}: ${section.text}`).join(' '),
    hasLabel: Boolean(label)
  };

  appState.labelCache.set(cacheKey, report);
  return report;
}

function renderSearchResults(results) {
  dom.searchResults.innerHTML = '';

  if (!results.length) {
    dom.searchResults.innerHTML = `
      <div class="empty-state">
        <p>No RxNorm matches found. Try a generic name, brand name, or tap “Add typed item” for vitamins, supplements, or custom review items.</p>
      </div>`;
    return;
  }

  for (const result of results) {
    const node = dom.resultTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.result-title').textContent = result.name;
    node.querySelector('.result-meta').textContent = `RxCUI ${result.rxcui} • ${result.tty} • score ${result.score ?? 'n/a'}`;
    node.addEventListener('click', () => selectDrug(result));
    dom.searchResults.appendChild(node);
  }
}

function renderSelectedDrugSkeleton(drug) {
  dom.drugDetail.className = '';
  const sourceLabel = String(drug.rxcui || '').startsWith('custom:') ? 'Manual item' : 'RxNorm';
  dom.drugDetail.innerHTML = `
    <div class="drug-header">
      <div class="drug-title-row">
        <div>
          <p class="eyebrow">Selected item</p>
          <h2>${escapeHtml(drug.name)}</h2>
        </div>
      </div>
      <div class="identifier-row">
        <span class="identifier-pill">ID: ${escapeHtml(drug.rxcui)}</span>
        <span class="identifier-pill">Type: ${escapeHtml(drug.tty || 'Unknown')}</span>
        <span class="identifier-pill">Source: ${escapeHtml(sourceLabel)}</span>
      </div>
      <div class="action-row">
        <button class="primary-btn" id="addToListBtn" type="button">Add to interaction set</button>
        <button class="ghost-btn" id="loadLabelBtn" type="button">Load FDA label</button>
      </div>
    </div>
    <div id="labelContainer" class="label-container">
      <div class="empty-state"><p>Tap “Load FDA label” to fetch public product-label sections for this medication or supplement term.</p></div>
    </div>
  `;
  document.querySelector('#addToListBtn')?.addEventListener('click', () => addDrugToMedList(drug));
  document.querySelector('#loadLabelBtn')?.addEventListener('click', () => loadAndRenderLabel(drug));
}

function selectDrug(drug) {
  appState.selected = drug;
  dom.saveDrugBtn.disabled = false;
  dom.studyNotes.disabled = false;
  dom.saveNotesBtn.disabled = false;
  const saved = appState.library[drug.rxcui];
  dom.studyNotes.value = saved?.notes ?? '';
  renderSelectedDrugSkeleton(drug);
}

async function loadAndRenderLabel(drug) {
  const container = document.querySelector('#labelContainer');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><p>Loading FDA label sections…</p></div>';

  try {
    const labels = await searchOpenFdaLabels(drug.name);
    if (!labels.length) {
      container.innerHTML = '<div class="empty-state"><p>No matching openFDA label found. Try searching the generic ingredient name, brand name, or a simpler supplement term.</p></div>';
      return;
    }

    const label = labels[0];
    const meta = bestLabelMeta(label);
    drug.label = label;
    drug.labelSearchName = drug.name;

    const sections = LABEL_FIELDS.map(([key, title]) => {
      const text = sectionText(label, key, 1800);
      if (!text) return '';
      return `
        <details class="label-section" ${key === 'boxed_warning' || key === 'indications_and_usage' ? 'open' : ''}>
          <summary>${escapeHtml(title)}</summary>
          <div class="label-body">${escapeHtml(text)}</div>
        </details>
      `;
    }).filter(Boolean).join('');

    container.innerHTML = `
      <div class="drug-header">
        <p class="muted"><strong>Label match:</strong> ${escapeHtml(meta.brand || meta.generic || drug.name)}${meta.manufacturer ? ` • ${escapeHtml(meta.manufacturer)}` : ''}${meta.route ? ` • ${escapeHtml(meta.route)}` : ''}</p>
        <p class="fine-print">Sections come from public FDA structured product-label data. Product labeling varies by manufacturer, ingredient, and dosage form.</p>
      </div>
      ${sections || '<div class="empty-state"><p>This label record did not include the supported sections.</p></div>'}
    `;
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message || 'Could not load FDA label data.')}</p></div>`;
  }
}

function addDrugToMedList(drug) {
  if (!drug?.rxcui) return;
  if (!appState.medList.some((item) => item.rxcui === drug.rxcui)) {
    appState.medList.push({ rxcui: drug.rxcui, name: drug.name, tty: drug.tty || '' });
    saveState();
  }
  renderMedList();
  setStatus(`${drug.name} added to the interaction set.`, 'success');
}

function addTypedItemToMedList() {
  const name = dom.drugSearchInput.value.trim();
  if (!name) {
    setStatus('Type a medication, vitamin, supplement, or food cue first.', 'error');
    return;
  }
  const manual = { rxcui: `custom:${slugify(name)}`, name, tty: 'Manual review item' };
  addDrugToMedList(manual);
  selectDrug(manual);
  setActiveTab('reference');
}

function removeDrugFromMedList(rxcui) {
  appState.medList = appState.medList.filter((item) => item.rxcui !== rxcui);
  saveState();
  renderMedList();
}

function renderMedList() {
  if (!appState.medList.length) {
    dom.medList.innerHTML = '<div class="empty-state"><p>No items in this interaction set yet.</p></div>';
    return;
  }

  dom.medList.innerHTML = appState.medList.map((item) => `
    <div class="stack-item">
      <strong>${escapeHtml(item.name)}</strong>
      <small>${String(item.rxcui).startsWith('custom:') ? 'Manual item' : `RxCUI ${escapeHtml(item.rxcui)}`}${item.tty ? ` • ${escapeHtml(item.tty)}` : ''}</small>
      <div class="stack-actions">
        <button class="ghost-btn small" data-action="open" data-rxcui="${escapeHtml(item.rxcui)}" type="button">Open</button>
        <button class="ghost-btn small" data-action="remove" data-rxcui="${escapeHtml(item.rxcui)}" type="button">Remove</button>
      </div>
    </div>
  `).join('');

  dom.medList.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const rxcui = button.getAttribute('data-rxcui');
      const action = button.getAttribute('data-action');
      if (action === 'remove') removeDrugFromMedList(rxcui);
      if (action === 'open') {
        const cached = appState.searchResults.find((item) => item.rxcui === rxcui) || appState.medList.find((item) => item.rxcui === rxcui);
        if (cached) {
          selectDrug(cached);
          setActiveTab('reference');
        }
      }
    });
  });
}

function saveSelectedDrug() {
  const drug = appState.selected;
  if (!drug?.rxcui) return;
  const previous = appState.library[drug.rxcui] ?? {};
  appState.library[drug.rxcui] = {
    rxcui: drug.rxcui,
    name: drug.name,
    tty: drug.tty || '',
    notes: previous.notes ?? '',
    savedAt: previous.savedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  saveState();
  renderLibrary();
  setStatus(`${drug.name} saved to your local notebook.`, 'success');
}

function saveSelectedNotes() {
  const drug = appState.selected;
  if (!drug?.rxcui) return;
  const previous = appState.library[drug.rxcui] ?? { rxcui: drug.rxcui, name: drug.name, tty: drug.tty || '', savedAt: new Date().toISOString() };
  appState.library[drug.rxcui] = {
    ...previous,
    notes: dom.studyNotes.value.trim(),
    updatedAt: new Date().toISOString()
  };
  saveState();
  renderLibrary();
  setStatus('Notes saved locally on this device.', 'success');
}

function deleteLibraryItem(rxcui) {
  delete appState.library[rxcui];
  saveState();
  renderLibrary();
}

function renderLibrary() {
  const items = Object.values(appState.library).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  if (!items.length) {
    dom.savedLibrary.innerHTML = '<div class="empty-state"><p>Your saved drug notes will appear here.</p></div>';
    return;
  }

  dom.savedLibrary.innerHTML = items.map((item) => `
    <div class="stack-item">
      <strong>${escapeHtml(item.name)}</strong>
      <small>${String(item.rxcui).startsWith('custom:') ? 'Manual item' : `RxCUI ${escapeHtml(item.rxcui)}`}${item.updatedAt ? ` • updated ${new Date(item.updatedAt).toLocaleDateString()}` : ''}</small>
      <small>${escapeHtml(truncate(item.notes || 'No notes yet.', 140))}</small>
      <div class="stack-actions">
        <button class="ghost-btn small" data-action="load-library" data-rxcui="${escapeHtml(item.rxcui)}" type="button">Load</button>
        <button class="ghost-btn small" data-action="delete-library" data-rxcui="${escapeHtml(item.rxcui)}" type="button">Delete</button>
      </div>
    </div>
  `).join('');

  dom.savedLibrary.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const rxcui = button.getAttribute('data-rxcui');
      const action = button.getAttribute('data-action');
      const item = appState.library[rxcui];
      if (action === 'delete-library') deleteLibraryItem(rxcui);
      if (action === 'load-library' && item) {
        selectDrug(item);
        dom.studyNotes.value = item.notes || '';
        setActiveTab('notebook');
      }
    });
  });
}

function analyzePair(left, right) {
  const leftTargets = right.terms;
  const rightTargets = left.terms;
  const leftDirect = extractSnippets(left.allSafetyText, leftTargets, 7);
  const rightDirect = extractSnippets(right.allSafetyText, rightTargets, 7);
  const cueTerms = isSupplementLike(left.drug) || isSupplementLike(right.drug) ? FOOD_SUPPLEMENT_CUE_TERMS : [];
  const cueSnippets = cueTerms.length ? uniqueList([
    ...extractSnippets(left.allSafetyText, cueTerms, 4).map((text) => `${left.drug.name}: ${text}`),
    ...extractSnippets(right.allSafetyText, cueTerms, 4).map((text) => `${right.drug.name}: ${text}`)
  ], 6) : [];
  const evidenceText = [leftDirect, rightDirect, cueSnippets].flat().join(' ');
  const broaderRiskText = [evidenceText, left.allSafetyText, right.allSafetyText].join(' ');
  const outcomeLabels = detectRuleLabels(evidenceText, OUTCOME_RULES);
  const riskLabels = detectRuleLabels(broaderRiskText, RISK_FACTOR_RULES);
  const directCount = leftDirect.length + rightDirect.length;
  const severity = highestSeverity(evidenceText);

  let riskLabel = 'No direct pair listing found';
  let riskClass = 'neutral';
  if (!left.hasLabel || !right.hasLabel) {
    riskLabel = 'Incomplete public-label data';
    riskClass = 'unknown';
  } else if (severity >= 3) {
    riskLabel = 'Listed high-concern language';
    riskClass = 'high';
  } else if (directCount > 0 || severity >= 2) {
    riskLabel = 'Listed caution / possible outcome';
    riskClass = 'caution';
  } else if (cueSnippets.length > 0) {
    riskLabel = 'Food/supplement cues found';
    riskClass = 'caution';
  }

  return {
    left,
    right,
    leftDirect,
    rightDirect,
    cueSnippets,
    outcomeLabels,
    riskLabels,
    riskLabel,
    riskClass
  };
}

function renderChipList(items, emptyText = 'No specific signal found in returned label text.') {
  if (!items.length) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<div class="chip-list">${items.map((item) => `<span class="info-chip">${escapeHtml(item)}</span>`).join('')}</div>`;
}

function renderSnippetList(title, snippets, emptyText) {
  if (!snippets.length) {
    return `
      <div class="evidence-block">
        <h4>${escapeHtml(title)}</h4>
        <p class="muted">${escapeHtml(emptyText)}</p>
      </div>`;
  }
  return `
    <div class="evidence-block">
      <h4>${escapeHtml(title)}</h4>
      <ul>${snippets.map((snippet) => `<li>${escapeHtml(snippet)}</li>`).join('')}</ul>
    </div>`;
}

function renderPairReport(pair) {
  return `
    <article class="pair-card ${escapeHtml(pair.riskClass)}">
      <div class="pair-head">
        <div>
          <p class="eyebrow">Pair review</p>
          <h3>${escapeHtml(pair.left.drug.name)} + ${escapeHtml(pair.right.drug.name)}</h3>
        </div>
        <span class="risk-badge ${escapeHtml(pair.riskClass)}">${escapeHtml(pair.riskLabel)}</span>
      </div>
      <div class="analysis-grid">
        <div>
          <h4>Possible outcomes mentioned</h4>
          ${renderChipList(pair.outcomeLabels)}
        </div>
        <div>
          <h4>Listed risk factors</h4>
          ${renderChipList(pair.riskLabels)}
        </div>
      </div>
      ${renderSnippetList(`${pair.left.drug.name} label mentions ${pair.right.drug.name}`, pair.leftDirect, 'No direct mention found in the returned label sections.')}
      ${renderSnippetList(`${pair.right.drug.name} label mentions ${pair.left.drug.name}`, pair.rightDirect, 'No direct mention found in the returned label sections.')}
      ${pair.cueSnippets.length ? renderSnippetList('Food / vitamin / supplement cues', pair.cueSnippets, '') : ''}
    </article>
  `;
}

function renderIndividualLabelReport(report) {
  const interactions = report.sections.drug_interactions?.text || 'No drug_interactions section returned in the selected public label record.';
  const contraindications = report.sections.contraindications?.text || '';
  const warnings = report.sections.boxed_warning?.text || report.sections.warnings?.text || report.sections.warnings_and_cautions?.text || '';
  const metaName = report.meta.brand || report.meta.generic || report.drug.name;
  return `
    <details class="label-section">
      <summary>${escapeHtml(report.drug.name)} individual label review</summary>
      <div class="label-body">
        <strong>Label match:</strong> ${escapeHtml(metaName)}${report.meta.manufacturer ? ` • ${escapeHtml(report.meta.manufacturer)}` : ''}${report.meta.route ? ` • ${escapeHtml(report.meta.route)}` : ''}\n\n<strong>Drug interactions:</strong> ${escapeHtml(truncate(interactions, 900))}${contraindications ? `\n\n<strong>Contraindications:</strong> ${escapeHtml(truncate(contraindications, 650))}` : ''}${warnings ? `\n\n<strong>Warnings:</strong> ${escapeHtml(truncate(warnings, 650))}` : ''}
      </div>
    </details>
  `;
}

function buildReviewText(reports, pairAnalyses) {
  const lines = [];
  lines.push('PhactoryRx — Interaction Tab Report');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('Educational label-text review only. Not medical advice or a clinical interaction checker.');
  lines.push('');

  for (const pair of pairAnalyses) {
    lines.push(`${pair.left.drug.name} + ${pair.right.drug.name}`);
    lines.push(`Risk summary: ${pair.riskLabel}`);
    if (pair.outcomeLabels.length) lines.push(`Possible outcomes mentioned: ${pair.outcomeLabels.join(', ')}`);
    if (pair.riskLabels.length) lines.push(`Risk factors listed: ${pair.riskLabels.join(', ')}`);
    [...pair.leftDirect, ...pair.rightDirect, ...pair.cueSnippets].forEach((snippet) => lines.push(`- ${snippet}`));
    if (!pair.leftDirect.length && !pair.rightDirect.length && !pair.cueSnippets.length) lines.push('- No direct combined condition was found in the returned public label sections.');
    lines.push('');
  }

  lines.push('Individual label sections reviewed:');
  for (const report of reports) {
    lines.push(`- ${report.drug.name}: ${report.hasLabel ? (report.meta.brand || report.meta.generic || 'openFDA label found') : 'no matching openFDA label found'}`);
  }

  return lines.join('\n');
}

async function reviewLabels() {
  if (appState.medList.length < 2) {
    dom.interactionReview.className = 'empty-state';
    dom.interactionReview.innerHTML = '<p>Add at least two medications, vitamins, supplements, or food cues to the interaction set first.</p>';
    setActiveTab('interactions');
    return;
  }

  setActiveTab('interactions');
  dom.interactionReview.className = 'empty-state';
  dom.interactionReview.innerHTML = '<p>Fetching public label sections and building pairwise interaction review…</p>';

  const reviewItems = appState.medList.slice(0, 10);
  const skipped = appState.medList.length > reviewItems.length ? appState.medList.length - reviewItems.length : 0;

  try {
    const reports = [];
    for (const drug of reviewItems) {
      try {
        reports.push(await getLabelReport(drug));
      } catch (error) {
        reports.push({
          drug,
          label: null,
          meta: { brand: '', generic: '', manufacturer: '', route: '' },
          terms: buildSearchTermsFromText(drug.name),
          sections: {},
          allSafetyText: error.message || 'Could not fetch label data.',
          hasLabel: false,
          error: error.message || 'Could not fetch label data.'
        });
      }
    }

    const pairAnalyses = [];
    for (let i = 0; i < reports.length; i += 1) {
      for (let j = i + 1; j < reports.length; j += 1) {
        pairAnalyses.push(analyzePair(reports[i], reports[j]));
      }
    }

    appState.lastReviewText = buildReviewText(reports, pairAnalyses);
    const noLabelWarnings = reports.filter((report) => !report.hasLabel);

    dom.interactionReview.className = 'review-report';
    dom.interactionReview.innerHTML = `
      <div class="review-summary">
        <h3>Interaction tab report</h3>
        <p>${escapeHtml(pairAnalyses.length)} pair${pairAnalyses.length === 1 ? '' : 's'} analyzed from ${escapeHtml(reports.length)} item${reports.length === 1 ? '' : 's'}. ${skipped ? `${escapeHtml(skipped)} extra item${skipped === 1 ? '' : 's'} skipped to keep the public API review manageable.` : ''}</p>
        <p class="fine-print">This finds listed label text, outcome language, food/supplement cues, and risk-factor language. Absence of a direct mention does not prove the combination is safe.</p>
        ${noLabelWarnings.length ? `<p class="fine-print warning-text">No public label match was found for: ${escapeHtml(noLabelWarnings.map((report) => report.drug.name).join(', '))}.</p>` : ''}
      </div>
      ${pairAnalyses.map(renderPairReport).join('')}
      <div class="individual-review">
        <h3>Individual label sections</h3>
        ${reports.map(renderIndividualLabelReport).join('')}
      </div>
    `;
  } catch (error) {
    dom.interactionReview.className = 'empty-state';
    dom.interactionReview.innerHTML = `<p>${escapeHtml(error.message || 'Could not complete interaction review.')}</p>`;
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const term = dom.drugSearchInput.value.trim();
  if (!term) return;

  setStatus('Searching RxNorm…');
  dom.searchResults.innerHTML = '';

  try {
    const results = await searchRxNorm(term);
    appState.searchResults = results;
    renderSearchResults(results);
    setStatus(results.length ? `Found ${results.length} RxNorm match${results.length === 1 ? '' : 'es'}.` : 'No RxNorm match found. You can still add the typed item manually for label review.', results.length ? 'success' : '');
  } catch (error) {
    setStatus(error.message || 'Search failed. Check your connection and try again.', 'error');
  }
}

function exportNotebook() {
  const data = {
    app: 'PhactoryRx',
    exportedAt: new Date().toISOString(),
    library: appState.library,
    medList: appState.medList
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `phactoryrx-notebook-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importNotebook(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      if (!parsed.library || typeof parsed.library !== 'object') throw new Error('Invalid notebook file.');
      appState.library = parsed.library;
      appState.medList = Array.isArray(parsed.medList) ? parsed.medList : appState.medList;
      saveState();
      renderLibrary();
      renderMedList();
      setStatus('Notebook imported successfully.', 'success');
    } catch (error) {
      setStatus(error.message || 'Import failed.', 'error');
    }
  });
  reader.readAsText(file);
}

function resetApp() {
  appState.selected = null;
  appState.searchResults = [];
  dom.drugSearchInput.value = '';
  dom.searchResults.innerHTML = '';
  dom.drugDetail.className = 'empty-state';
  dom.drugDetail.innerHTML = '<p>Search for a medication to view naming data, identifiers, and available FDA label sections.</p>';
  dom.studyNotes.value = '';
  dom.studyNotes.disabled = true;
  dom.saveNotesBtn.disabled = true;
  dom.saveDrugBtn.disabled = true;
  setStatus('');
}

function setActiveTab(tabName) {
  const target = tabName || 'reference';
  dom.tabBtns.forEach((button) => {
    const isActive = button.getAttribute('data-tab') === target;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  dom.tabPanels.forEach((panel) => {
    panel.hidden = panel.getAttribute('data-panel') !== target;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((error) => {
        console.warn('Service worker registration failed.', error);
      });
    });
  }
}

function wireInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    appState.deferredInstallPrompt = event;
    dom.installBtn.classList.remove('hidden');
  });

  dom.installBtn.addEventListener('click', async () => {
    if (!appState.deferredInstallPrompt) return;
    appState.deferredInstallPrompt.prompt();
    await appState.deferredInstallPrompt.userChoice;
    appState.deferredInstallPrompt = null;
    dom.installBtn.classList.add('hidden');
  });
}

function bindEvents() {
  dom.drugSearchForm.addEventListener('submit', handleSearch);
  dom.clearAllBtn.addEventListener('click', resetApp);
  dom.manualAddBtn.addEventListener('click', addTypedItemToMedList);
  dom.saveDrugBtn.addEventListener('click', saveSelectedDrug);
  dom.saveNotesBtn.addEventListener('click', saveSelectedNotes);
  dom.reviewLabelsBtn.addEventListener('click', reviewLabels);
  dom.runInteractionBtn.addEventListener('click', reviewLabels);
  dom.exportBtn.addEventListener('click', exportNotebook);
  dom.importBtn.addEventListener('click', () => dom.importFile.click());
  dom.importFile.addEventListener('change', () => importNotebook(dom.importFile.files?.[0]));
  dom.copyReviewBtn.addEventListener('click', async () => {
    if (!appState.lastReviewText) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(appState.lastReviewText);
      setStatus('Interaction report copied to clipboard.', 'success');
    }
  });
  document.querySelectorAll('.chip-btn[data-example]').forEach((button) => {
    button.addEventListener('click', () => {
      dom.drugSearchInput.value = button.getAttribute('data-example') || '';
      dom.drugSearchForm.requestSubmit();
    });
  });
  dom.tabBtns.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.getAttribute('data-tab')));
  });
}

function init() {
  loadState();
  renderMedList();
  renderLibrary();
  setActiveTab('reference');
  bindEvents();
  wireInstallPrompt();
  registerServiceWorker();
}

init();
