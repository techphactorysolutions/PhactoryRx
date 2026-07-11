'use strict';
/* PhactoryRx tab smoke test (no dependencies).
 * Builds a minimal DOM stub from index.html, executes app.js, and verifies:
 *  - init() completes without throwing
 *  - clicking each tab shows exactly that panel and updates aria state
 *  - user tab clicks trigger scroll-to-top
 *  - adding a typed item on the Interactions tab does NOT switch tabs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

/* ---- tiny element model built from static HTML tags ---- */
class StubElement {
  constructor(attrs) {
    this.attrs = attrs;
    this.listeners = {};
    this.classList = {
      set: new Set((attrs.class || '').split(/\s+/).filter(Boolean)),
      toggle(name, force) { force ? this.set.add(name) : this.set.delete(name); },
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); }
    };
    this.hidden = 'hidden' in attrs;
    this.disabled = 'disabled' in attrs;
    this.value = '';
    this.innerHTML = '';
    this.textContent = '';
    this.className = attrs.class || '';
    this.tabIndex = 0;
    this.isConnected = true;
    this.files = [];
  }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatch(type, event = {}) {
    event.preventDefault ||= () => {};
    (this.listeners[type] || []).forEach((handler) => handler(event));
  }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  focus() {}
  click() { this.dispatch('click'); }
  scrollIntoView() {}
  appendChild() {}
}

const elements = [];
const tagPattern = /<(?!\/)(?!!)([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*\/?>/gi;
let match;
while ((match = tagPattern.exec(html)) !== null) {
  const attrs = {};
  const attrPattern = /([a-z-]+)(?:="([^"]*)")?/gi;
  let attrMatch;
  while ((attrMatch = attrPattern.exec(match[2])) !== null) {
    attrs[attrMatch[1]] = attrMatch[2] ?? '';
  }
  elements.push(new StubElement(attrs));
}

const byId = new Map(elements.filter((el) => el.attrs.id).map((el) => [el.attrs.id, el]));
const template = byId.get('resultTemplate');
if (template) template.content = { firstElementChild: new StubElement({}) };

function select(selector) {
  if (selector.startsWith('#')) return byId.get(selector.slice(1)) || null;
  const attr = selector.match(/^\[([a-z-]+)\]$/);
  if (attr) return elements.filter((el) => attr[1] in el.attrs);
  const chip = selector.match(/^\.([a-z-]+)\[([a-z-]+)\]$/);
  if (chip) return elements.filter((el) => el.classList.contains(chip[1]) && chip[2] in el.attrs);
  return [];
}

let scrollCalls = 0;
const documentStub = {
  querySelector: (selector) => {
    const result = select(selector);
    return Array.isArray(result) ? (result[0] || null) : result;
  },
  querySelectorAll: (selector) => {
    const result = select(selector);
    return Array.isArray(result) ? result : (result ? [result] : []);
  },
  createElement: () => new StubElement({}),
  body: new StubElement({})
};
const windowStub = {
  addEventListener: () => {},
  matchMedia: () => ({ matches: false }),
  navigator: { userAgent: 'smoke-test' },
  scrollTo: () => { scrollCalls += 1; },
  setTimeout,
  location: { origin: 'http://localhost' }
};

const sandbox = {
  document: documentStub,
  window: windowStub,
  navigator: windowStub.navigator,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console,
  fetch: () => Promise.reject(new Error('offline test')),
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  Blob: class {},
  FileReader: class { addEventListener() {} readAsText() {} }
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

let passed = 0;
let failed = 0;
function assert(name, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

/* ---- run app.js ---- */
try {
  vm.createContext(sandbox);
  vm.runInContext(appSource, sandbox, { filename: 'app.js' });
  assert('app.js init() runs without throwing', true);
} catch (error) {
  assert('app.js init() runs without throwing', false, error.stack.split('\n')[0]);
  process.exit(1);
}

const tabButtons = select('[data-tab]');
const panels = select('[data-panel]');
assert('3 tab buttons and 3 panels found', tabButtons.length === 3 && panels.length === 3);

function visiblePanels() {
  return panels.filter((panel) => !panel.hidden).map((panel) => panel.attrs['data-panel']);
}
assert('initial state shows only reference panel',
  JSON.stringify(visiblePanels()) === '["reference"]', JSON.stringify(visiblePanels()));

for (const target of ['interactions', 'notebook', 'reference']) {
  const button = tabButtons.find((btn) => btn.attrs['data-tab'] === target);
  const before = scrollCalls;
  button.dispatch('click');
  assert(`clicking ${target} tab shows only that panel`,
    JSON.stringify(visiblePanels()) === JSON.stringify([target]), JSON.stringify(visiblePanels()));
  assert(`clicking ${target} tab sets aria-selected`,
    button.getAttribute('aria-selected') === 'true'
    && tabButtons.filter((btn) => btn.getAttribute('aria-selected') === 'true').length === 1);
  assert(`clicking ${target} tab scrolls to top`, scrollCalls === before + 1);
}

/* typed-item add must not steal the active tab */
const interactionsButton = tabButtons.find((btn) => btn.attrs['data-tab'] === 'interactions');
interactionsButton.dispatch('click');
const addForm = byId.get('interactionAddForm');
const addInput = byId.get('interactionAddInput');
addInput.value = 'grapefruit';
addForm.dispatch('submit');
assert('adding a typed item stays on the Interactions tab',
  JSON.stringify(visiblePanels()) === '["interactions"]', JSON.stringify(visiblePanels()));
assert('typed-item input clears after add', addInput.value === '');
const statusBanner = byId.get('statusBanner');
assert('status banner confirms the add', /added to the interaction set/i.test(statusBanner.textContent),
  statusBanner.textContent);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
