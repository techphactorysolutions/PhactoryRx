'use strict';

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';
const OPENFDA_LABEL = 'https://api.fda.gov/drug/label.json';
const STORAGE_KEY = 'phactoryrx-v2';
const LEGACY_STORAGE_KEYS = ['phactoryrx-v1', 'phactory-pharmacology-v2', 'phactory-pharmacology-v1'];
const MAX_MED_LIST_ITEMS = 10;
const MAX_ANALYSIS_ITEMS = 10;
const MAX_LIBRARY_ITEMS = 500;
const MAX_NOTE_LENGTH = 20000;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_SEARCH_RESULTS = 24;
const MAX_LABEL_RESULTS = 12;
const MIN_LABEL_MATCH_SCORE = 82;

const PRODUCT_TTYS = new Set(['SCD', 'SBD', 'GPCK', 'BPCK', 'SCDG', 'SBDG', 'SCDC', 'SBDC', 'SCDF', 'SBDF']);
const INGREDIENT_TTYS = new Set(['IN', 'PIN', 'MIN']);
const TTY_LABELS = {
  IN: 'Ingredient', PIN: 'Precise ingredient', MIN: 'Combination ingredient', BN: 'Brand',
  SCD: 'Generic product', SBD: 'Branded product', GPCK: 'Generic pack', BPCK: 'Branded pack',
  SCDC: 'Generic strength', SBDC: 'Branded strength', SCDF: 'Generic dosage form', SBDF: 'Branded dosage form',
  SCDG: 'Generic form group', SBDG: 'Branded form group'
};
const ROUTE_WORDS = ['oral', 'topical', 'intravenous', 'intramuscular', 'subcutaneous', 'sublingual', 'buccal', 'rectal', 'vaginal', 'ophthalmic', 'otic', 'nasal', 'inhalation', 'transdermal', 'intradermal', 'epidural'];
const DOSE_FORM_WORDS = ['tablet', 'capsule', 'solution', 'suspension', 'injection', 'cream', 'ointment', 'gel', 'spray', 'aerosol', 'powder', 'film', 'patch', 'syrup', 'lozenge', 'suppository', 'drops', 'implant', 'inhaler'];
const FORMULATION_MODIFIERS = ['extended release', 'delayed release', 'immediate release', 'controlled release', 'sustained release', 'enteric coated', 'chewable', 'disintegrating', 'effervescent'];

const LABEL_FIELDS = [
  ['boxed_warning', 'Boxed Warning'],
  ['indications_and_usage', 'Indications & Usage'],
  ['purpose', 'Purpose / OTC Use'],
  ['description', 'Official Description'],
  ['mechanism_of_action', 'Mechanism of Action'],
  ['clinical_pharmacology', 'Clinical Pharmacology'],
  ['active_ingredient', 'Active Ingredient'],
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
  { label: 'Reduced or negated effect', pattern: /(?:\b(?:decrease[sd]?|decreasing|reduce[sd]?|reduced|lower(?:ed)?|diminish(?:ed)?)\b.{0,80}\b(?:concentration|exposure|effect|efficacy|absorption|levels?|response|bioavailability)\b|\b(?:loss of efficacy|less effective|impaired absorption|inhibited absorption)\b)/i, severity: 2 },
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
  { label: 'Bleeding history or disorder', pattern: /\b(bleeding disorder|history of bleeding|active bleeding|thrombocytopenia|platelet disorder|peptic ulcer|hemorrhage|haemorrhage)\b/i },
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
  searchSubmitBtn: document.querySelector('#searchSubmitBtn'),
  clearMedListBtn: document.querySelector('#clearMedListBtn'),
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
  library: Object.create(null),
  labelCache: new Map(),
  identityCache: new Map(),
  lastReviewText: '',
  deferredInstallPrompt: null,
  searchVersion: 0,
  interactionRunning: false,
  labelLoadVersion: 0
};

function emptyLibrary() {
  return Object.create(null);
}

function isSafeRecordKey(value) {
  const key = String(value || '');
  return /^(?:\d{1,20}|custom:[a-z0-9-]{1,88})$/i.test(key)
    && !['__proto__', 'prototype', 'constructor'].includes(key.toLowerCase());
}

function sanitizeTimestamp(value) {
  const text = sanitizeText(value, 64);
  if (!text) return '';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatSavedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function sanitizeText(value, maxLength = 240) {
  return normalizeWhitespace(String(value ?? '')).slice(0, maxLength);
}

function sanitizeDrug(value) {
  if (!value || typeof value !== 'object') return null;
  const name = sanitizeText(value.name, 120);
  const rxcui = sanitizeText(value.rxcui, 96);
  if (!name || !rxcui || !isSafeRecordKey(rxcui)) return null;
  return {
    rxcui,
    name,
    tty: sanitizeText(value.tty, 80),
    synonym: sanitizeText(value.synonym, 160)
  };
}

function sanitizeMedList(value) {
  if (!Array.isArray(value)) return [];
  const output = [];
  const seen = new Set();
  for (const candidate of value) {
    const drug = sanitizeDrug(candidate);
    if (!drug || seen.has(drug.rxcui)) continue;
    seen.add(drug.rxcui);
    output.push(drug);
    if (output.length >= MAX_MED_LIST_ITEMS) break;
  }
  return output;
}

function sanitizeLibrary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyLibrary();
  const output = emptyLibrary();
  for (const candidate of Object.values(value).slice(0, MAX_LIBRARY_ITEMS)) {
    const drug = sanitizeDrug(candidate);
    if (!drug) continue;
    output[drug.rxcui] = {
      ...drug,
      notes: String(candidate.notes ?? '').slice(0, MAX_NOTE_LENGTH),
      savedAt: sanitizeTimestamp(candidate.savedAt),
      updatedAt: sanitizeTimestamp(candidate.updatedAt)
    };
  }
  return output;
}

function loadState() {
  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      appState.library = sanitizeLibrary(parsed.library);
      appState.medList = sanitizeMedList(parsed.medList);
      saveState();
      return;
    } catch (error) {
      console.warn(`Could not load local state from ${key}.`, error);
    }
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      library: sanitizeLibrary(appState.library),
      medList: sanitizeMedList(appState.medList)
    }));
    return true;
  } catch (error) {
    console.warn('Could not save local state.', error);
    return false;
  }
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
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      cache: 'no-store'
    });
    if (response.status === 404) return null;
    if (response.status === 429) {
      throw new Error('The public data source is rate-limiting requests. Try again later.');
    }
    if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The public data source took too long to respond. Try again.');
    }
    throw error;
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

function rxTypeLabel(tty) {
  return TTY_LABELS[String(tty || '').toUpperCase()] || String(tty || 'Medication concept');
}

function conceptPriority(tty) {
  const key = String(tty || '').toUpperCase();
  if (INGREDIENT_TTYS.has(key)) return 0;
  if (key === 'BN') return 1;
  if (key === 'SCD' || key === 'SBD') return 2;
  if (key === 'GPCK' || key === 'BPCK') return 3;
  return 4;
}

function normalizedNameForMatch(value) {
  return normalizeWhitespace(String(value || ''))
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatchQuality(name, term) {
  const left = normalizedNameForMatch(name);
  const right = normalizedNameForMatch(term);
  if (!left || !right) return 0;
  if (left === right) return 5;
  if (left.startsWith(right) || right.startsWith(left)) return 4;
  if (left.includes(right) || right.includes(left)) return 3;
  const rightTokens = right.split(' ').filter(Boolean);
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  return rightTokens.length && rightTokens.every((token) => leftTokens.has(token)) ? 2 : 0;
}

function conceptsFromDrugGroups(json, source) {
  const output = [];
  for (const group of toArray(json?.drugGroup?.conceptGroup)) {
    for (const concept of toArray(group?.conceptProperties)) {
      const rxcui = String(concept?.rxcui || '');
      if (!/^\d{1,20}$/.test(rxcui)) continue;
      output.push({
        rxcui,
        name: concept.name || concept.psn || `RxCUI ${rxcui}`,
        synonym: concept.synonym || '',
        tty: concept.tty || group.tty || '',
        language: concept.language || '',
        suppress: concept.suppress || '',
        psn: concept.psn || '',
        matchSource: source,
        score: source === 'Formulation match' ? 98 : 100
      });
    }
  }
  return output;
}

async function hydrateRxConcept(candidate) {
  if (candidate.name && candidate.tty && candidate.tty !== 'Unknown type') return candidate;
  try {
    const properties = await getRxProperties(candidate.rxcui);
    return {
      ...candidate,
      name: candidate.name || properties?.name || `RxCUI ${candidate.rxcui}`,
      tty: candidate.tty || properties?.tty || 'Unknown type',
      synonym: candidate.synonym || properties?.synonym || '',
      language: candidate.language || properties?.language || '',
      suppress: candidate.suppress || properties?.suppress || '',
      properties
    };
  } catch (error) {
    return { ...candidate, name: candidate.name || `RxCUI ${candidate.rxcui}`, tty: candidate.tty || 'Unknown type', properties: null };
  }
}

async function searchRxNorm(term) {
  const safeTerm = normalizeWhitespace(term).slice(0, 80);
  const productUrl = `${RXNAV_BASE}/drugs.json?name=${encodeURIComponent(safeTerm)}&expand=psn`;
  const exactUrl = `${RXNAV_BASE}/rxcui.json?name=${encodeURIComponent(safeTerm)}&search=2`;
  const initial = await Promise.allSettled([fetchJson(productUrl), fetchJson(exactUrl)]);
  const candidates = [];
  let firstError = null;

  if (initial[0].status === 'fulfilled') {
    candidates.push(...conceptsFromDrugGroups(initial[0].value, 'Formulation match'));
  } else {
    firstError = initial[0].reason;
  }

  if (initial[1].status === 'fulfilled') {
    for (const rxcui of toArray(initial[1].value?.idGroup?.rxnormId).map(String)) {
      if (/^\d{1,20}$/.test(rxcui)) candidates.push({ rxcui, matchSource: 'Exact/normalized match', score: 100 });
    }
  } else {
    firstError = firstError || initial[1].reason;
  }

  if (candidates.length < 6) {
    try {
      const approximateUrl = `${RXNAV_BASE}/approximateTerm.json?term=${encodeURIComponent(safeTerm)}&maxEntries=12&option=1`;
      const approximate = await fetchJson(approximateUrl);
      for (const candidate of toArray(approximate?.approximateGroup?.candidate)) {
        const rxcui = String(candidate?.rxcui || '');
        if (!/^\d{1,20}$/.test(rxcui)) continue;
        candidates.push({
          rxcui,
          name: candidate.name || '',
          score: Number(candidate.score || 0),
          rank: candidate.rank,
          matchSource: 'Approximate match'
        });
      }
    } catch (error) {
      firstError = firstError || error;
    }
  }

  const uniqueMap = new Map();
  for (const candidate of candidates) {
    if (!uniqueMap.has(candidate.rxcui)) uniqueMap.set(candidate.rxcui, candidate);
    else if (candidate.matchSource === 'Exact/normalized match') uniqueMap.set(candidate.rxcui, { ...uniqueMap.get(candidate.rxcui), ...candidate });
  }

  if (!uniqueMap.size && firstError) throw firstError;

  const preliminary = [...uniqueMap.values()]
    .sort((a, b) => {
      const qualityDiff = nameMatchQuality(b.name, safeTerm) - nameMatchQuality(a.name, safeTerm);
      if (qualityDiff) return qualityDiff;
      const typeDiff = conceptPriority(a.tty) - conceptPriority(b.tty);
      if (typeDiff) return typeDiff;
      return Number(b.score || 0) - Number(a.score || 0);
    })
    .slice(0, MAX_SEARCH_RESULTS);

  const hydrated = await Promise.all(preliminary.map(hydrateRxConcept));
  return hydrated
    .filter((item) => item.name && item.suppress !== 'Y')
    .sort((a, b) => {
      const qualityDiff = nameMatchQuality(b.name, safeTerm) - nameMatchQuality(a.name, safeTerm);
      if (qualityDiff) return qualityDiff;
      const typeDiff = conceptPriority(a.tty) - conceptPriority(b.tty);
      if (typeDiff) return typeDiff;
      return String(a.name).localeCompare(String(b.name));
    });
}

function cleanedLabelName(drugOrTerm) {
  const raw = typeof drugOrTerm === 'string' ? drugOrTerm : (drugOrTerm?.name || '');
  return raw
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%)\b/gi, ' ')
    .replace(/\b(?:oral|tablet|capsule|solution|suspension|injection|extended release|delayed release|topical|cream|ointment|gel|spray|aerosol|powder|film|patch|syrup|chewable|sublingual|intravenous|intramuscular|subcutaneous)\b/gi, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelSearchTerms(drugOrTerm) {
  const raw = typeof drugOrTerm === 'string' ? drugOrTerm : (drugOrTerm?.name || '');
  const cleaned = cleanedLabelName(drugOrTerm);
  return Array.from(new Set([raw, cleaned]
    .map((term) => normalizeWhitespace(term))
    .filter((term) => term.length >= 3 && isUsableTerm(term))));
}

function labelMatchTerms(drugOrTerm) {
  const raw = typeof drugOrTerm === 'string' ? drugOrTerm : (drugOrTerm?.name || '');
  const cleaned = cleanedLabelName(drugOrTerm);
  return Array.from(new Set([raw, cleaned]
    .map((term) => normalizeWhitespace(term).toLowerCase())
    .filter((term) => term.length >= 3)));
}

function makeOpenFdaQuery(term) {
  const safe = String(term).replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return `(openfda.generic_name:"${safe}" OR openfda.brand_name:"${safe}" OR openfda.substance_name:"${safe}")`;
}

function labelIdentity(label) {
  const fda = label?.openfda ?? {};
  return toArray(fda.spl_set_id)[0]
    || toArray(label?.set_id)[0]
    || toArray(label?.id)[0]
    || [
      ...toArray(fda.generic_name),
      ...toArray(fda.brand_name),
      ...toArray(fda.manufacturer_name)
    ].map((value) => normalizeWhitespace(value).toLowerCase()).join('|');
}

function conceptsFromRelatedGroups(json) {
  const groups = Object.create(null);
  for (const group of toArray(json?.relatedGroup?.conceptGroup)) {
    const tty = String(group?.tty || '').toUpperCase();
    groups[tty] = toArray(group?.conceptProperties).map((concept) => ({
      rxcui: String(concept?.rxcui || ''),
      name: normalizeWhitespace(concept?.name || concept?.synonym || ''),
      tty
    })).filter((concept) => concept.name);
  }
  return groups;
}

function wordsFromList(value, vocabulary) {
  const text = normalizeWhitespace(toArray(value).join(' ')).toLowerCase();
  return vocabulary.filter((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(text));
}

function phrasesFromList(value, vocabulary) {
  const text = normalizeWhitespace(toArray(value).join(' ')).toLowerCase();
  return vocabulary.filter((phrase) => text.includes(phrase));
}

async function resolveDrugIdentity(drugOrTerm) {
  const isObject = drugOrTerm && typeof drugOrTerm === 'object';
  const name = normalizeWhitespace(isObject ? drugOrTerm.name : drugOrTerm);
  const rxcui = isObject ? String(drugOrTerm.rxcui || '') : '';
  const cacheKey = `${rxcui}:${name}`.toLowerCase();
  if (appState.identityCache.has(cacheKey)) return appState.identityCache.get(cacheKey);

  let properties = isObject ? (drugOrTerm.properties || null) : null;
  let relatedGroups = Object.create(null);
  if (/^\d{1,20}$/.test(rxcui)) {
    try {
      const [propertyResult, relatedResult] = await Promise.allSettled([
        properties ? Promise.resolve(properties) : getRxProperties(rxcui),
        fetchJson(`${RXNAV_BASE}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=IN+PIN+MIN+BN+DF+DFG`)
      ]);
      if (propertyResult.status === 'fulfilled') properties = propertyResult.value;
      if (relatedResult.status === 'fulfilled') relatedGroups = conceptsFromRelatedGroups(relatedResult.value);
    } catch (error) {
      console.warn('RxNorm identity enrichment failed.', error);
    }
  }

  const tty = String(properties?.tty || (isObject ? drugOrTerm.tty : '') || '').toUpperCase();
  const selectedNames = uniqueList([name, isObject ? drugOrTerm.synonym : '', properties?.name, properties?.synonym].filter(Boolean), 8);
  const fallbackIngredients = (PRODUCT_TTYS.has(tty) || INGREDIENT_TTYS.has(tty))
    ? cleanedLabelName(name).split(/\s*\/\s*|\s+\+\s+/).map((item) => normalizeWhitespace(item)).filter(isUsableTerm)
    : [];
  const ingredientCandidates = [
    ...toArray(relatedGroups.IN).map((item) => item.name),
    ...toArray(relatedGroups.PIN).map((item) => item.name),
    ...toArray(relatedGroups.MIN).flatMap((item) => item.name.split(/\s*\/\s*|\s+\+\s+/).map((part) => normalizeWhitespace(part))),
    ...((tty === 'IN' || tty === 'PIN') ? selectedNames : []),
    ...fallbackIngredients
  ].filter(Boolean);
  const ingredientMap = new Map();
  for (const ingredient of ingredientCandidates) {
    const key = comparableDrugName(ingredient);
    if (key && !ingredientMap.has(key)) ingredientMap.set(key, ingredient);
  }
  const ingredients = [...ingredientMap.values()].slice(0, 10);
  const brands = uniqueList([
    ...toArray(relatedGroups.BN).map((item) => item.name),
    ...(tty === 'BN' ? selectedNames : [])
  ].filter(Boolean), 8);
  const doseForms = uniqueList([
    ...toArray(relatedGroups.DF).map((item) => item.name),
    ...toArray(relatedGroups.DFG).map((item) => item.name),
    ...wordsFromList(selectedNames, DOSE_FORM_WORDS)
  ].filter(Boolean), 8);
  const routes = uniqueList(wordsFromList(selectedNames, ROUTE_WORDS), 8);
  const modifiers = uniqueList(phrasesFromList(selectedNames, FORMULATION_MODIFIERS), 8);

  const identity = {
    name,
    rxcui,
    tty,
    selectedNames,
    ingredients,
    brands,
    doseForms,
    routes,
    modifiers,
    isProduct: PRODUCT_TTYS.has(tty),
    isIngredient: INGREDIENT_TTYS.has(tty),
    isCustom: !/^\d{1,20}$/.test(rxcui)
  };
  appState.identityCache.set(cacheKey, identity);
  return identity;
}

function labelValues(label) {
  const fda = label?.openfda ?? {};
  return {
    generic: toArray(fda.generic_name).map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean),
    brand: toArray(fda.brand_name).map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean),
    substance: toArray(fda.substance_name).map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean),
    route: toArray(fda.route).map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean),
    dosageForm: toArray(fda.dosage_form).map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean),
    productType: toArray(fda.product_type).map((value) => normalizeWhitespace(value).toUpperCase()).filter(Boolean),
    rxcui: toArray(fda.rxcui).map(String)
  };
}

function isHumanDrugLabel(label) {
  const values = labelValues(label);
  if (values.productType.some((type) => /ANIMAL|VETERINARY/.test(type))) return false;
  const identityText = [...values.generic, ...values.brand, ...values.substance].join(' ');
  if (/\b(veterinary|for animal use|canine|feline|equine|cattle|swine|poultry)\b/i.test(identityText)) return false;
  return true;
}

function comparableDrugName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(hydrochloride|hcl|sodium|potassium|calcium|acetate|succinate|tartrate|mesylate|besylate|maleate|sulfate|phosphate)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(left, right) {
  const a = comparableDrugName(left);
  const b = comparableDrugName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aTokens = a.split(' ').filter((token) => token.length > 1 && !TERM_STOPWORDS.has(token));
  const bTokens = new Set(b.split(' ').filter((token) => token.length > 1 && !TERM_STOPWORDS.has(token)));
  return aTokens.length > 0 && aTokens.every((token) => bTokens.has(token));
}

function countLabelActiveIngredients(values) {
  const rawEntries = values.substance.length ? values.substance : values.generic;
  const entries = uniqueList(rawEntries.map(comparableDrugName).filter(Boolean), 20);
  const rawText = rawEntries.join(' ');
  if (/\s\/\s|\band\b|\s\+\s/i.test(rawText) && entries.length < 2) return 2;
  return entries.length;
}

function labelMatchDecision(label, requestedDrugOrName, identityOverride = null) {
  if (!isHumanDrugLabel(label)) return { score: -1000, reason: 'Non-human product label rejected', exactRxcui: false, matchedIngredients: 0 };
  const identity = identityOverride || appState.identityCache.get(`${requestedDrugOrName?.rxcui || ''}:${requestedDrugOrName?.name || requestedDrugOrName || ''}`.toLowerCase()) || {
    rxcui: typeof requestedDrugOrName === 'object' ? String(requestedDrugOrName?.rxcui || '') : '',
    selectedNames: labelMatchTerms(requestedDrugOrName),
    ingredients: [], brands: [], routes: [], doseForms: [], modifiers: [], isProduct: false, isIngredient: false, isCustom: true
  };
  const values = labelValues(label);
  const allNames = [...values.generic, ...values.brand, ...values.substance];
  const exactRxcui = /^\d{1,20}$/.test(identity.rxcui) && values.rxcui.includes(identity.rxcui);
  const exactProduct = exactRxcui && identity.isProduct;
  let score = exactRxcui ? (exactProduct ? 240 : 170) : 0;
  let reason = exactProduct ? 'Exact product RxCUI match' : (exactRxcui ? 'RxCUI ingredient match' : '');

  const exactSelectedName = identity.selectedNames.some((name) => allNames.some((value) => namesMatch(name, value)));
  if (exactSelectedName) {
    score = Math.max(score, 118);
    if (!reason) reason = 'Exact medication-name match';
  }

  const matchedIngredients = identity.ingredients.filter((ingredient) => [...values.generic, ...values.substance].some((value) => namesMatch(ingredient, value))).length;
  if (matchedIngredients) {
    score = Math.max(score, 96 + Math.min(24, matchedIngredients * 8));
    if (!reason) reason = matchedIngredients === identity.ingredients.length ? 'Ingredient match' : 'Partial ingredient match';
  }

  const brandMatch = identity.brands.some((brand) => values.brand.some((value) => namesMatch(brand, value)));
  if (brandMatch) {
    score = Math.max(score, 108);
    if (!reason) reason = 'Brand-name match';
  }

  const routeMatch = !identity.routes.length || identity.routes.some((route) => values.route.some((value) => value.includes(route)));
  const doseFormMatch = !identity.doseForms.length || identity.doseForms.some((form) => values.dosageForm.some((value) => value.includes(comparableDrugName(form)) || comparableDrugName(form).includes(value)));
  if (identity.routes.length) score += routeMatch ? 18 : -38;
  if (identity.doseForms.length) score += doseFormMatch ? 12 : -22;
  const labelFormulationText = [...values.generic, ...values.brand, ...values.dosageForm].join(' ');
  const modifierMatch = !identity.modifiers.length || identity.modifiers.some((modifier) => labelFormulationText.includes(modifier));
  if (identity.modifiers.length) score += modifierMatch ? 24 : -46;

  if (identity.ingredients.length > 1 && matchedIngredients < identity.ingredients.length && !exactRxcui) score -= 75;
  if (identity.isProduct && !exactRxcui && !exactSelectedName && !brandMatch) score -= 45;
  if (identity.ingredients.length === 1 && countLabelActiveIngredients(values) > 1) {
    score = Math.min(score, 55);
    reason = 'Combination product rejected for single-ingredient lookup';
  }
  if (identity.isCustom && !exactSelectedName) score = Math.min(score, 30);

  return { score, reason: reason || 'Low-confidence name match', exactRxcui, exactProduct, matchedIngredients, routeMatch, doseFormMatch, modifierMatch };
}

async function searchOpenFdaLabels(drugOrTerm) {
  const identity = await resolveDrugIdentity(drugOrTerm);
  const queries = [];
  if (/^\d{1,20}$/.test(identity.rxcui)) queries.push(`openfda.rxcui:"${identity.rxcui}"`);
  for (const term of identity.ingredients.slice(0, 3)) queries.push(makeOpenFdaQuery(term));
  for (const term of identity.brands.slice(0, 2)) queries.push(makeOpenFdaQuery(term));
  if (!identity.ingredients.length && !identity.brands.length) {
    for (const term of labelSearchTerms(drugOrTerm).slice(0, 2)) queries.push(makeOpenFdaQuery(term));
  }

  const collected = [];
  const seen = new Set();
  let lastError = null;
  let validResponses = 0;

  for (const query of Array.from(new Set(queries)).slice(0, 5)) {
    try {
      const url = `${OPENFDA_LABEL}?search=${encodeURIComponent(query)}&limit=${MAX_LABEL_RESULTS}`;
      const response = await fetchJson(url);
      validResponses += 1;
      for (const label of toArray(response?.results)) {
        if (!isHumanDrugLabel(label)) continue;
        const id = labelIdentity(label) || JSON.stringify(label?.openfda || label).slice(0, 500);
        if (seen.has(id)) continue;
        seen.add(id);
        collected.push(label);
      }
      const best = bestLabelDecision(collected, drugOrTerm, identity);
      if (best?.decision.exactProduct || best?.decision.score >= 135) break;
    } catch (error) {
      lastError = error;
      if (/rate-limiting|too long/i.test(error.message || '')) throw error;
    }
  }

  if (!validResponses && lastError) throw lastError;
  return collected;
}

function bestLabelMeta(label) {
  const fda = label?.openfda ?? {};
  const brand = toArray(fda.brand_name)[0] || '';
  const generic = toArray(fda.generic_name)[0] || '';
  const manufacturer = toArray(fda.manufacturer_name)[0] || '';
  const route = toArray(fda.route).join(', ');
  const dosageForm = toArray(fda.dosage_form).join(', ');
  const substances = uniqueList(toArray(fda.substance_name), 10);
  const productType = toArray(fda.product_type).join(', ');
  const setId = toArray(fda.spl_set_id)[0] || toArray(label?.set_id)[0] || '';
  const effectiveTime = sanitizeText(label?.effective_time, 16);
  const pharmClasses = uniqueList([
    ...toArray(fda.pharm_class_epc),
    ...toArray(fda.pharm_class_moa),
    ...toArray(fda.pharm_class_cs)
  ], 10);
  return { brand, generic, manufacturer, route, dosageForm, substances, productType, setId, effectiveTime, pharmClasses };
}

function bestLabelDecision(labels, requestedDrugOrName, identityOverride = null) {
  const ranked = [...labels]
    .map((label) => ({ label, decision: labelMatchDecision(label, requestedDrugOrName, identityOverride) }))
    .sort((a, b) => b.decision.score - a.decision.score);
  return ranked[0]?.decision.score >= MIN_LABEL_MATCH_SCORE ? ranked[0] : null;
}

function labelMatchScore(label, requestedDrugOrName) {
  return labelMatchDecision(label, requestedDrugOrName).score;
}

function pickBestLabel(labels, requestedDrugOrName) {
  return bestLabelDecision(labels, requestedDrugOrName)?.label || null;
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

function shortHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

function manualItemId(name) {
  const normalized = normalizeWhitespace(name).toLowerCase();
  return `custom:${slugify(normalized)}-${shortHash(normalized)}`;
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

function summarySentences(text, maxSentences = 4, maxChars = 1500) {
  const sentences = splitSentences(text).filter((sentence) => sentence.length > 15);
  if (!sentences.length) return truncate(normalizeWhitespace(text), maxChars);
  return truncate(sentences.slice(0, maxSentences).join(' '), maxChars);
}

function buildIdentityDescription(drug, meta) {
  const displayName = meta.generic || meta.brand || drug.name;
  const ingredients = meta.substances.length ? meta.substances.join(', ') : '';
  const form = [meta.route, meta.dosageForm].filter(Boolean).join(' ');
  const className = String(meta.pharmClasses?.[0] || '').replace(/\s*\[[^\]]+\]\s*$/g, '').trim();
  const parts = [`${displayName} is ${className ? `a ${className} medication` : 'a medication product'}`];
  if (form) parts.push(`provided as ${form.toLowerCase()}`);
  if (ingredients) parts.push(`containing ${ingredients}`);
  return `${parts.join(' ')}.`;
}

function buildLabelSummary(label, drug, meta) {
  const usesRaw = rawSectionText(label, 'indications_and_usage', 7000)
    || rawSectionText(label, 'purpose', 4000)
    || rawSectionText(label, 'uses', 4000);
  const descriptionRaw = rawSectionText(label, 'description', 7000);
  const mechanismRaw = rawSectionText(label, 'mechanism_of_action', 5000)
    || rawSectionText(label, 'clinical_pharmacology', 5000);
  const identityDescription = buildIdentityDescription(drug, meta);
  const officialDescription = summarySentences(descriptionRaw, 4, 1200);
  return {
    uses: summarySentences(usesRaw, 5, 1800),
    description: truncate([identityDescription, officialDescription].filter(Boolean).join(' '), 1700),
    mechanism: summarySentences(mechanismRaw, 4, 1500),
    classes: meta.pharmClasses
  };
}

function officialLabelUrl(setId) {
  const safe = String(setId || '').trim();
  return /^[a-f0-9-]{20,}$/i.test(safe)
    ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(safe)}`
    : '';
}

function renderSummaryCard(title, text, emptyText, className = '') {
  return `
    <section class="summary-card ${escapeHtml(className)}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text || emptyText)}</p>
    </section>
  `;
}

async function getLabelReport(drug) {
  const cacheKey = `${drug.rxcui || ''}:${drug.name}`.toLowerCase();
  if (appState.labelCache.has(cacheKey)) return appState.labelCache.get(cacheKey);

  const labels = await searchOpenFdaLabels(drug);
  const best = bestLabelDecision(labels, drug);
  const label = best?.label || null;
  const meta = label ? bestLabelMeta(label) : { brand: '', generic: '', manufacturer: '', route: '', dosageForm: '', substances: [], productType: '', setId: '', effectiveTime: '', pharmClasses: [] };
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
    matchDecision: best?.decision || null,
    summary: label ? buildLabelSummary(label, drug, meta) : null,
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
        <p>No RxNorm matches found. Check the spelling or try the generic ingredient or brand name.</p>
      </div>`;
    return;
  }

  for (const result of results) {
    const node = dom.resultTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.result-title').textContent = result.name;
    node.querySelector('.result-meta').textContent = `${rxTypeLabel(result.tty)} • ${result.matchSource || 'RxNorm'} • RxCUI ${result.rxcui}`;
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
          <p class="eyebrow">Selected medication</p>
          <h2>${escapeHtml(drug.name)}</h2>
        </div>
      </div>
      <div class="identifier-row">
        <span class="identifier-pill">RxCUI: ${escapeHtml(drug.rxcui)}</span>
        <span class="identifier-pill">${escapeHtml(rxTypeLabel(drug.tty))}</span>
        <span class="identifier-pill">Source: ${escapeHtml(sourceLabel)}</span>
      </div>
      <p class="selection-guidance">The app is matching the exact RxNorm concept above. For product-specific information, choose the result with the correct strength and dosage form.</p>
      <div class="action-row">
        <button class="primary-btn" id="addToListBtn" type="button">Add to interaction set</button>
        <button class="ghost-btn" id="loadLabelBtn" type="button">Retry label lookup</button>
      </div>
    </div>
    <div id="labelContainer" class="label-container" aria-live="polite">
      <div class="empty-state"><p>Resolving the exact medication and loading official label uses and description…</p></div>
    </div>
  `;
  document.querySelector('#addToListBtn')?.addEventListener('click', () => addDrugToMedList(drug));
  document.querySelector('#loadLabelBtn')?.addEventListener('click', () => loadAndRenderLabel(drug, true));
}

function selectDrug(drug) {
  appState.labelLoadVersion += 1;
  appState.selected = drug;
  dom.saveDrugBtn.disabled = false;
  dom.studyNotes.disabled = false;
  dom.saveNotesBtn.disabled = false;
  const saved = appState.library[drug.rxcui];
  dom.studyNotes.value = saved?.notes ?? '';
  renderSelectedDrugSkeleton(drug);
  setActiveTab('reference');
  loadAndRenderLabel(drug);
}

async function loadAndRenderLabel(drug, forceRefresh = false) {
  const container = document.querySelector('#labelContainer');
  if (!container) return;
  const button = document.querySelector('#loadLabelBtn');
  const requestVersion = ++appState.labelLoadVersion;
  const cacheKey = `${drug.rxcui || ''}:${drug.name}`.toLowerCase();
  if (forceRefresh) {
    appState.labelCache.delete(cacheKey);
    appState.identityCache.delete(cacheKey);
  }
  if (button) {
    button.disabled = true;
    button.textContent = 'Loading…';
  }
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '<div class="empty-state"><p>Matching the RxNorm concept to an official human-drug label…</p></div>';

  try {
    const labels = await searchOpenFdaLabels(drug);
    if (requestVersion !== appState.labelLoadVersion || !container.isConnected) return;
    const best = bestLabelDecision(labels, drug);
    if (!best) {
      container.innerHTML = `
        <div class="empty-state accuracy-warning">
          <strong>No reliable matching label was found.</strong>
          <p>PhactoryRx refused to display a low-confidence description. Try the generic ingredient name, or choose a result with the exact strength and dosage form.</p>
        </div>`;
      return;
    }

    const label = best.label;
    const decision = best.decision;
    const meta = bestLabelMeta(label);
    const summary = buildLabelSummary(label, drug, meta);
    drug.label = label;
    drug.labelSearchName = drug.name;

    const sections = LABEL_FIELDS.map(([key, title]) => {
      const text = sectionText(label, key, 2200);
      if (!text) return '';
      return `
        <details class="label-section" ${key === 'boxed_warning' ? 'open' : ''}>
          <summary>${escapeHtml(title)}</summary>
          <div class="label-body">${escapeHtml(text)}</div>
        </details>
      `;
    }).filter(Boolean).join('');

    const officialUrl = officialLabelUrl(meta.setId);
    const matchLabel = decision.exactProduct ? 'Exact product RxCUI verified' : decision.reason;
    const metadata = [meta.manufacturer, meta.route, meta.dosageForm].filter(Boolean).join(' • ');
    container.innerHTML = `
      <div class="verified-label-card">
        <div class="verified-label-head">
          <div>
            <p class="eyebrow">Verified label match</p>
            <h3>${escapeHtml(meta.brand || meta.generic || drug.name)}</h3>
          </div>
          <span class="match-badge ${decision.exactProduct ? 'exact' : ''}">${escapeHtml(matchLabel)}</span>
        </div>
        ${metadata ? `<p class="muted">${escapeHtml(metadata)}</p>` : ''}
        <p class="fine-print">Matched against the selected RxNorm concept. A low-confidence or non-human label is not displayed.</p>
        ${officialUrl ? `<a class="official-link" href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">Open official DailyMed label</a>` : ''}
      </div>
      <div class="summary-grid">
        ${renderSummaryCard('Uses', summary.uses, 'This matched label did not include an indications or purpose section.', 'uses')}
        ${renderSummaryCard('Description', summary.description, 'No official description was returned for this product.', 'description')}
        ${summary.mechanism ? renderSummaryCard('How it works', summary.mechanism, '', 'mechanism') : ''}
        ${summary.classes.length ? renderSummaryCard('Drug class', summary.classes.join(' • '), '', 'class') : ''}
      </div>
      <div class="label-sections-heading">
        <h3>Full label sections</h3>
        <p class="muted">Expand a section for more detail.</p>
      </div>
      ${sections || '<div class="empty-state"><p>This matched label did not include the supported sections.</p></div>'}
    `;
  } catch (error) {
    if (requestVersion === appState.labelLoadVersion && container.isConnected) {
      container.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message || 'Could not load FDA label data.')}</p></div>`;
    }
  } finally {
    if (requestVersion === appState.labelLoadVersion && container.isConnected) container.removeAttribute('aria-busy');
    if (requestVersion === appState.labelLoadVersion && button?.isConnected) {
      button.disabled = false;
      button.textContent = 'Retry label lookup';
    }
  }
}

function addDrugToMedList(drug) {
  const cleanDrug = sanitizeDrug(drug);
  if (!cleanDrug) return;
  const normalizedName = normalizeWhitespace(cleanDrug.name).toLowerCase();
  if (appState.medList.some((item) => item.rxcui === cleanDrug.rxcui || normalizeWhitespace(item.name).toLowerCase() === normalizedName)) {
    setStatus(`${cleanDrug.name} is already in the interaction set.`, 'success');
    return;
  }
  if (appState.medList.length >= MAX_MED_LIST_ITEMS) {
    setStatus(`The interaction set is limited to ${MAX_MED_LIST_ITEMS} items. Remove one before adding another.`, 'error');
    return;
  }
  appState.medList.push(cleanDrug);
  const saved = saveState();
  renderMedList();
  setStatus(saved
    ? `${cleanDrug.name} added to the interaction set.`
    : `${cleanDrug.name} was added for this session, but local storage is unavailable.`, saved ? 'success' : 'error');
}

function addTypedItemToMedList() {
  const name = dom.drugSearchInput.value.trim();
  if (!name) {
    setStatus('Type a medication, vitamin, supplement, or food cue first.', 'error');
    return;
  }
  const manual = { rxcui: manualItemId(name), name, tty: 'Manual review item' };
  addDrugToMedList(manual);
  selectDrug(manual);
  setActiveTab('reference');
}

function removeDrugFromMedList(rxcui) {
  if (appState.interactionRunning) {
    setStatus('Wait for the current interaction analysis to finish before changing the set.', 'error');
    return;
  }
  appState.medList = appState.medList.filter((item) => item.rxcui !== rxcui);
  saveState();
  renderMedList();
}

function clearMedList() {
  if (appState.interactionRunning) {
    setStatus('Wait for the current interaction analysis to finish before clearing the set.', 'error');
    return;
  }
  appState.medList = [];
  appState.lastReviewText = '';
  dom.copyReviewBtn.disabled = true;
  dom.interactionReview.className = 'empty-state';
  dom.interactionReview.innerHTML = '<p>Add two or more items to the interaction set, then tap Run analysis.</p>';
  const saved = saveState();
  renderMedList();
  setStatus(saved ? 'Interaction set cleared.' : 'Interaction set cleared for this session, but local storage is unavailable.', saved ? 'success' : 'error');
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
  if (!appState.library[drug.rxcui] && Object.keys(appState.library).length >= MAX_LIBRARY_ITEMS) {
    setStatus(`Your notebook is limited to ${MAX_LIBRARY_ITEMS} saved items. Delete one before saving another.`, 'error');
    return;
  }
  appState.library[drug.rxcui] = {
    rxcui: drug.rxcui,
    name: drug.name,
    tty: drug.tty || '',
    notes: previous.notes ?? '',
    savedAt: previous.savedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const saved = saveState();
  renderLibrary();
  setStatus(saved ? `${drug.name} saved to your local notebook.` : `${drug.name} is available for this session, but local storage is unavailable.`, saved ? 'success' : 'error');
}

function saveSelectedNotes() {
  const drug = appState.selected;
  if (!drug?.rxcui) return;
  if (!appState.library[drug.rxcui] && Object.keys(appState.library).length >= MAX_LIBRARY_ITEMS) {
    setStatus(`Your notebook is limited to ${MAX_LIBRARY_ITEMS} saved items. Delete one before saving another.`, 'error');
    return;
  }
  const previous = appState.library[drug.rxcui] ?? { rxcui: drug.rxcui, name: drug.name, tty: drug.tty || '', savedAt: new Date().toISOString() };
  appState.library[drug.rxcui] = {
    ...previous,
    notes: dom.studyNotes.value.trim().slice(0, MAX_NOTE_LENGTH),
    updatedAt: new Date().toISOString()
  };
  const saved = saveState();
  renderLibrary();
  setStatus(saved ? 'Notes saved locally on this device.' : 'Notes are available for this session, but local storage is unavailable.', saved ? 'success' : 'error');
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
      <small>${String(item.rxcui).startsWith('custom:') ? 'Manual item' : `RxCUI ${escapeHtml(item.rxcui)}`}${formatSavedDate(item.updatedAt) ? ` • updated ${escapeHtml(formatSavedDate(item.updatedAt))}` : ''}</small>
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
  const evidenceText = [leftDirect, rightDirect].flat().join(' ');
  const broaderRiskText = [left.allSafetyText, right.allSafetyText].join(' ');
  const outcomeLabels = detectRuleLabels(evidenceText, OUTCOME_RULES);
  const riskLabels = detectRuleLabels(evidenceText, RISK_FACTOR_RULES);
  const backgroundRiskLabels = detectRuleLabels(broaderRiskText, RISK_FACTOR_RULES)
    .filter((label) => !riskLabels.includes(label));
  const directCount = leftDirect.length + rightDirect.length;
  const severity = highestSeverity(evidenceText);
  const labelCount = Number(left.hasLabel) + Number(right.hasLabel);
  const coverageLabel = labelCount === 2
    ? 'Both item labels matched'
    : labelCount === 1
      ? 'Partial coverage: one item label matched'
      : 'No matching item labels';

  let riskLabel = 'No direct pair listing found';
  let riskClass = 'neutral';
  if (severity >= 3) {
    riskLabel = 'Listed high-concern language';
    riskClass = 'high';
  } else if (directCount > 0 || severity >= 2) {
    riskLabel = 'Listed caution / possible outcome';
    riskClass = 'caution';
  } else if (cueSnippets.length > 0) {
    riskLabel = 'Food/supplement cues found';
    riskClass = 'caution';
  } else if (labelCount < 2) {
    riskLabel = 'Incomplete public-label data';
    riskClass = 'unknown';
  }

  return {
    left,
    right,
    leftDirect,
    rightDirect,
    cueSnippets,
    outcomeLabels,
    riskLabels,
    backgroundRiskLabels,
    riskLabel,
    riskClass,
    labelCount,
    coverageLabel
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
      <p class="coverage-note ${pair.labelCount < 2 ? 'partial' : ''}">${escapeHtml(pair.coverageLabel)}. Findings can come from either item’s matched label; missing label coverage does not negate direct evidence found in the other label.</p>
      <div class="analysis-grid">
        <div>
          <h4>Possible outcomes mentioned</h4>
          ${renderChipList(pair.outcomeLabels)}
        </div>
        <div>
          <h4>Pair-linked risk factors</h4>
          ${renderChipList(pair.riskLabels, 'No pair-linked risk factor was found in the matched evidence.')}
        </div>
      </div>
      <div class="analysis-grid single-row">
        <div>
          <h4>Other risk factors present in either label</h4>
          ${renderChipList(pair.backgroundRiskLabels, 'No additional background risk-factor language was detected.')}
        </div>
      </div>
      ${renderSnippetList(`${pair.left.drug.name} label mentions ${pair.right.drug.name}`, pair.leftDirect, 'No direct mention found in the returned label sections.')}
      ${renderSnippetList(`${pair.right.drug.name} label mentions ${pair.left.drug.name}`, pair.rightDirect, 'No direct mention found in the returned label sections.')}
      ${pair.cueSnippets.length ? renderSnippetList('Food / vitamin / supplement cues', pair.cueSnippets, '') : ''}
    </article>
  `;
}

function renderIndividualLabelReport(report) {
  if (!report.hasLabel) {
    return `
      <details class="label-section">
        <summary>${escapeHtml(report.drug.name)} individual label review</summary>
        <div class="label-body"><strong>No reliable openFDA label match.</strong>${report.error ? `\n\n${escapeHtml(report.error)}` : '\n\nTry the generic ingredient name or a more specific product name.'}</div>
      </details>
    `;
  }
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
    lines.push(`Label coverage: ${pair.coverageLabel}`);
    if (pair.outcomeLabels.length) lines.push(`Possible outcomes mentioned: ${pair.outcomeLabels.join(', ')}`);
    if (pair.riskLabels.length) lines.push(`Pair-linked risk factors: ${pair.riskLabels.join(', ')}`);
    if (pair.backgroundRiskLabels.length) lines.push(`Other risk factors in either label: ${pair.backgroundRiskLabels.join(', ')}`);
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
  if (appState.interactionRunning) return;
  if (appState.medList.length < 2) {
    dom.interactionReview.className = 'empty-state';
    dom.interactionReview.innerHTML = '<p>Add at least two medications, vitamins, supplements, or food cues to the interaction set first.</p>';
    dom.copyReviewBtn.disabled = true;
    setActiveTab('interactions');
    return;
  }

  appState.interactionRunning = true;
  dom.runInteractionBtn.disabled = true;
  dom.reviewLabelsBtn.disabled = true;
  dom.clearMedListBtn.disabled = true;
  dom.copyReviewBtn.disabled = true;
  dom.interactionReview.setAttribute('aria-busy', 'true');
  setActiveTab('interactions');
  dom.interactionReview.className = 'empty-state';
  dom.interactionReview.innerHTML = '<p>Fetching public label sections and building pairwise interaction review…</p>';

  const reviewItems = appState.medList.slice(0, MAX_ANALYSIS_ITEMS);
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
    dom.copyReviewBtn.disabled = false;
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
  } finally {
    appState.interactionRunning = false;
    dom.runInteractionBtn.disabled = false;
    dom.reviewLabelsBtn.disabled = false;
    dom.clearMedListBtn.disabled = false;
    dom.interactionReview.removeAttribute('aria-busy');
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const term = dom.drugSearchInput.value.trim();
  if (!term) return;

  const requestVersion = ++appState.searchVersion;
  dom.searchSubmitBtn.disabled = true;
  dom.drugSearchInput.setAttribute('aria-busy', 'true');
  setStatus('Searching RxNorm for ingredients, brands, strengths, and dosage forms…');
  dom.searchResults.innerHTML = '';

  try {
    const results = await searchRxNorm(term);
    if (requestVersion !== appState.searchVersion) return;
    appState.searchResults = results;
    renderSearchResults(results);
    setStatus(results.length ? `Found ${results.length} medication match${results.length === 1 ? '' : 'es'}. Choose the ingredient for a general overview, or the exact strength/form for product-specific information.` : 'No medication match found. Check the spelling or try the generic ingredient or brand name.', results.length ? 'success' : '');
  } catch (error) {
    if (requestVersion === appState.searchVersion) {
      setStatus(error.message || 'Search failed. Check your connection and try again.', 'error');
    }
  } finally {
    if (requestVersion === appState.searchVersion) {
      dom.searchSubmitBtn.disabled = false;
      dom.drugSearchInput.removeAttribute('aria-busy');
    }
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
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function importNotebook(file) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    setStatus('Notebook import is limited to 2 MB.', 'error');
    dom.importFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      if (!parsed.library || typeof parsed.library !== 'object' || Array.isArray(parsed.library)) {
        throw new Error('Invalid notebook file.');
      }
      appState.library = sanitizeLibrary(parsed.library);
      appState.medList = Array.isArray(parsed.medList) ? sanitizeMedList(parsed.medList) : appState.medList;
      const saved = saveState();
      renderLibrary();
      renderMedList();
      setStatus(saved ? 'Notebook imported successfully.' : 'Notebook imported for this session, but local storage is unavailable.', saved ? 'success' : 'error');
    } catch (error) {
      setStatus(error.message || 'Import failed.', 'error');
    } finally {
      dom.importFile.value = '';
    }
  });
  reader.addEventListener('error', () => {
    setStatus('The notebook file could not be read.', 'error');
    dom.importFile.value = '';
  });
  reader.readAsText(file);
}

function resetApp() {
  appState.searchVersion += 1;
  appState.labelLoadVersion += 1;
  appState.selected = null;
  appState.searchResults = [];
  dom.drugSearchInput.value = '';
  dom.searchResults.innerHTML = '';
  dom.drugDetail.className = 'empty-state';
  dom.drugDetail.innerHTML = '<p>Search for a medication, choose the correct ingredient or formulation, and PhactoryRx will load matched uses and a description.</p>';
  dom.studyNotes.value = '';
  dom.studyNotes.disabled = true;
  dom.saveNotesBtn.disabled = true;
  dom.saveDrugBtn.disabled = true;
  dom.searchSubmitBtn.disabled = false;
  dom.drugSearchInput.removeAttribute('aria-busy');
  setStatus('');
}

function setActiveTab(tabName) {
  const target = tabName || 'reference';
  dom.tabBtns.forEach((button) => {
    const isActive = button.getAttribute('data-tab') === target;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  dom.tabPanels.forEach((panel) => {
    panel.hidden = panel.getAttribute('data-panel') !== target;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
        .then((registration) => registration.update().catch(() => undefined))
        .catch((error) => {
          console.warn('Service worker registration failed.', error);
        });
    });
  }
}

async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('Clipboard API failed; trying fallback.', error);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand?.('copy') === true;
  textarea.remove();
  return copied;
}

function wireInstallPrompt() {
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');

  if (isIos && !isStandalone) {
    dom.installBtn.textContent = 'Add to Home';
    dom.installBtn.classList.remove('hidden');
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    appState.deferredInstallPrompt = event;
    dom.installBtn.textContent = 'Install';
    dom.installBtn.classList.remove('hidden');
  });

  dom.installBtn.addEventListener('click', async () => {
    if (!appState.deferredInstallPrompt) {
      if (isIos && !isStandalone) {
        setStatus('On iPhone or iPad: tap Safari’s Share button, then choose “Add to Home Screen.”', 'success');
        dom.statusBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    appState.deferredInstallPrompt.prompt();
    await appState.deferredInstallPrompt.userChoice;
    appState.deferredInstallPrompt = null;
    dom.installBtn.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    appState.deferredInstallPrompt = null;
    dom.installBtn.classList.add('hidden');
  });
}

function bindEvents() {
  dom.drugSearchForm.addEventListener('submit', handleSearch);
  dom.clearAllBtn.addEventListener('click', resetApp);
  dom.clearMedListBtn.addEventListener('click', clearMedList);
  dom.manualAddBtn.addEventListener('click', addTypedItemToMedList);
  dom.saveDrugBtn.addEventListener('click', saveSelectedDrug);
  dom.saveNotesBtn.addEventListener('click', saveSelectedNotes);
  dom.reviewLabelsBtn.addEventListener('click', reviewLabels);
  dom.runInteractionBtn.addEventListener('click', reviewLabels);
  dom.exportBtn.addEventListener('click', exportNotebook);
  dom.importBtn.addEventListener('click', () => dom.importFile.click());
  dom.importFile.addEventListener('change', () => importNotebook(dom.importFile.files?.[0]));
  dom.copyReviewBtn.addEventListener('click', async () => {
    if (!appState.lastReviewText) {
      setStatus('Run an interaction analysis before copying a report.', 'error');
      return;
    }
    const copied = await copyText(appState.lastReviewText);
    setStatus(copied ? 'Interaction report copied to clipboard.' : 'Clipboard access was unavailable. Select and copy the report manually.', copied ? 'success' : 'error');
  });
  document.querySelectorAll('.chip-btn[data-example]').forEach((button) => {
    button.addEventListener('click', () => {
      dom.drugSearchInput.value = button.getAttribute('data-example') || '';
      dom.drugSearchForm.requestSubmit();
    });
  });
  dom.tabBtns.forEach((button, index) => {
    button.addEventListener('click', () => setActiveTab(button.getAttribute('data-tab')));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % dom.tabBtns.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + dom.tabBtns.length) % dom.tabBtns.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = dom.tabBtns.length - 1;
      const nextButton = dom.tabBtns[nextIndex];
      setActiveTab(nextButton.getAttribute('data-tab'));
      nextButton.focus();
    });
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
