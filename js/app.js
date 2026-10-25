import { drawStepArt } from './art.js';
import config from './config.js';
import * as effects from './effects.js';
import { analyze } from './engine/index.js';
import { LANGUAGES, pickLanguage, t } from './i18n/index.js';

const STORAGE_KEY = 'redflag.lang';
const EXAMPLE_COUNT = 3;

const VERDICT_ICONS = {
  red: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M16.5 4h15L44 16.5v15L31.5 44h-15L4 31.5v-15L16.5 4Z" opacity=".22"/><path fill="none" stroke="currentColor" stroke-width="3" d="M16.5 4h15L44 16.5v15L31.5 44h-15L4 31.5v-15L16.5 4Z"/><path fill="currentColor" d="M22 13h4v15h-4zM22 32h4v4h-4z"/></svg>',
  yellow: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M24 5 45 42H3L24 5Z"/><path fill="currentColor" d="M22 18h4v13h-4zM22 34h4v4h-4z"/></svg>',
  green: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="m15 24.5 6 6 12-13"/></svg>',
};

const state = {
  lang: 'en',
  checkedText: null,
};

const elements = {
  form: document.getElementById('check-form'),
  message: document.getElementById('message'),
  error: document.getElementById('tool-error'),
  clear: document.getElementById('clear-button'),
  paste: document.getElementById('paste-button'),
  pasteError: document.getElementById('paste-error'),
  example: document.getElementById('example-button'),
  result: document.getElementById('result'),
  announcer: document.getElementById('result-announcer'),
  examples: document.getElementById('example-cards'),
  localTime: document.getElementById('local-time'),
  localPlace: document.getElementById('local-place'),
  langToggle: document.getElementById('lang-toggle'),
  langOptions: document.getElementById('lang-options'),
  langCurrent: document.getElementById('lang-current'),
  footerFlag: document.getElementById('footer-flag'),
  flagWave: document.getElementById('flag-wave'),
};

// localStorage throws in some private-browsing modes; the page should
// still work, it just won't remember the language.
function readSavedLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveLanguage(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not saved; nothing else depends on it.
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setLanguage(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;

  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n, lang);
  }

  for (const node of document.querySelectorAll('[data-i18n-attr]')) {
    const [attribute, key] = node.dataset.i18nAttr.split(':');
    node.setAttribute(attribute, t(key, lang));
  }

  for (const list of document.querySelectorAll('[data-i18n-list]')) {
    list.replaceChildren(...t(list.dataset.i18nList, lang).split('|').map((item) => el('li', '', item)));
  }

  for (const option of elements.langOptions.querySelectorAll('button')) {
    const selected = option.dataset.lang === lang;
    option.setAttribute('aria-checked', String(selected));
    if (selected) elements.langCurrent.textContent = option.querySelector('.lang-code').textContent;
  }

  renderStats();
  renderExamples();
  updateClock();
  if (state.checkedText !== null) renderResult(state.checkedText, { announce: false });
}

/** Builds the message as text nodes with <mark> around flagged spans. */
function highlightedMessage(text, highlights) {
  const view = el('div', 'message-view');
  let cursor = 0;
  for (const span of highlights) {
    if (span.start > cursor) view.append(text.slice(cursor, span.start));
    view.append(el('mark', '', text.slice(span.start, span.end)));
    cursor = span.end;
  }
  if (cursor < text.length) view.append(text.slice(cursor));
  return view;
}

function tagList(categories) {
  const tags = el('div', 'example-tags');
  for (const category of categories) tags.append(el('span', 'tag', t(`category.${category}`, state.lang)));
  return tags;
}

function uniqueByRule(flags) {
  const byRule = new Map();
  for (const flag of flags) {
    if (!byRule.has(flag.ruleId)) byRule.set(flag.ruleId, { ...flag, matches: [] });
    const entry = byRule.get(flag.ruleId);
    if (!entry.matches.includes(flag.match)) entry.matches.push(flag.match);
  }
  return [...byRule.values()].sort((a, b) => b.weight - a.weight);
}

function renderResult(text, { announce = true } = {}) {
  const { lang } = state;
  const result = analyze(text);
  const verdictText = t(`result.verdict.${result.verdict}`, lang);
  const summaryText = t(result.summaryKey, lang);

  const verdict = el('div', `verdict verdict-${result.verdict}`);
  verdict.insertAdjacentHTML('afterbegin', VERDICT_ICONS[result.verdict]);
  const verdictCopy = el('div');
  const heading = el('h2', 'verdict-title', verdictText);
  heading.id = 'result-title';
  verdictCopy.append(
    heading,
    el('p', 'verdict-summary', summaryText),
    el('p', 'verdict-score', t('result.score', lang, { score: result.score })),
  );
  verdict.append(verdictCopy);

  const body = el('div', 'result-body');

  const messageBlock = el('section');
  messageBlock.append(el('h3', 'result-heading', t('result.yourMessage', lang)), highlightedMessage(text, result.highlights));
  body.append(messageBlock);

  if (result.flags.length > 0) {
    const reasons = el('ul', 'flag-reasons');
    for (const flag of uniqueByRule(result.flags)) {
      const item = el('li', 'flag-reason');
      item.append(
        el('span', 'tag', t(`category.${flag.category}`, lang)),
        el('p', '', t(flag.explanationKey, lang)),
        el('p', 'flag-found', t('result.matched', lang, { match: flag.matches.map((m) => `“${m}”`).join(', ') })),
      );
      reasons.append(item);
    }
    const reasonsBlock = el('section');
    reasonsBlock.append(el('h3', 'result-heading', t('result.flagsTitle', lang)), reasons);
    body.append(reasonsBlock);
  }

  const advice = el('ol', 'advice');
  for (const key of result.adviceKeys) advice.append(el('li', '', t(key, lang)));
  const adviceBlock = el('section');
  adviceBlock.append(el('h3', 'result-heading', t('result.adviceTitle', lang)), advice);
  body.append(adviceBlock, el('p', 'result-disclaimer', t('result.disclaimer', lang)));

  elements.result.replaceChildren(verdict, body);
  elements.result.setAttribute('aria-labelledby', 'result-title');
  elements.result.hidden = false;

  if (announce) {
    elements.announcer.textContent = `${verdictText}. ${summaryText}`;
    effects.revealResult(elements.result);
  }
}

function check() {
  const text = elements.message.value;
  if (text.trim() === '') {
    elements.error.hidden = false;
    elements.message.focus();
    return;
  }

  elements.error.hidden = true;
  state.checkedText = text;
  renderResult(text);

  elements.result.tabIndex = -1;
  elements.result.focus({ preventScroll: true });
  // Jump rather than glide: less motion is easier to follow.
  elements.result.scrollIntoView({ block: 'start' });
}

function clear() {
  elements.message.value = '';
  elements.error.hidden = true;
  elements.result.hidden = true;
  elements.result.replaceChildren();
  elements.announcer.textContent = '';
  state.checkedText = null;
  elements.message.focus();
}

// Reading the clipboard happens on the device, like everything else. Some
// browsers refuse it, so fall back to telling people how to paste by hand.
async function pasteFromClipboard() {
  elements.pasteError.hidden = true;
  try {
    const text = await navigator.clipboard.readText();
    if (text.trim() === '') throw new Error('Clipboard is empty');
    checkText(text);
  } catch {
    elements.pasteError.hidden = false;
    elements.message.focus();
  }
}

function checkText(text) {
  elements.message.value = text;
  check();
}

function renderExamples() {
  const cards = [];
  for (let n = 1; n <= EXAMPLE_COUNT; n++) {
    const text = t(`examples.${n}.text`, state.lang);
    const result = analyze(text);
    const categories = [...new Set(result.flags.map((flag) => flag.category))];

    const card = el('article', 'card example');
    const button = el('button', 'btn btn-ghost', t('examples.check', state.lang));
    button.type = 'button';
    button.addEventListener('click', () => checkText(text));

    card.append(
      tagList(categories),
      el('h3', '', t(`examples.${n}.title`, state.lang)),
      highlightedMessage(text, result.highlights),
      button,
    );
    cards.push(card);
  }
  elements.examples.replaceChildren(...cards);
}

function renderStats() {
  const { messagesTested, catchRate } = config.stats;
  setStat('stat-tested', messagesTested === null ? null : String(messagesTested));
  setStat('stat-catch', catchRate === null ? null : `${Math.round(catchRate)}%`);
}

function setStat(id, value) {
  const node = document.getElementById(id);
  node.parentElement.classList.toggle('is-pending', value === null);
  node.textContent = value ?? t('stats.pending', state.lang);
}

// The city comes from the browser's time zone ("America/New_York"), so the
// header can show a place without asking for location or calling anything.
function localPlace() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  const city = zone.split('/').pop().replace(/_/g, ' ');
  return city && city !== 'UTC' ? city : t('nav.localTime', state.lang);
}

function updateClock() {
  elements.localPlace.textContent = localPlace();
  const time = new Date();
  elements.localTime.dateTime = time.toISOString();
  elements.localTime.textContent = new Intl.DateTimeFormat(state.lang, { hour: '2-digit', minute: '2-digit' }).format(time);
}

function setUpTicker() {
  const track = document.querySelector('.ticker-track');
  const list = track.querySelector('.ticker-list');
  // A second copy makes the loop seamless. It is hidden from screen readers
  // so the list is only read once.
  const copy = list.cloneNode(true);
  copy.setAttribute('aria-hidden', 'true');
  track.append(copy);
  track.classList.add('is-scrolling');
}

function languageButtons() {
  return [...elements.langOptions.querySelectorAll('button')];
}

function openLanguageMenu() {
  elements.langOptions.hidden = false;
  elements.langToggle.setAttribute('aria-expanded', 'true');
  effects.popIn(elements.langOptions);
  const current = languageButtons().find((button) => button.getAttribute('aria-checked') === 'true');
  (current ?? languageButtons()[0]).focus();
}

function closeLanguageMenu({ returnFocus = true } = {}) {
  if (elements.langOptions.hidden) return;
  elements.langOptions.hidden = true;
  elements.langToggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) elements.langToggle.focus();
}

function setUpLanguageMenu() {
  elements.langToggle.addEventListener('click', () => {
    if (elements.langOptions.hidden) openLanguageMenu();
    else closeLanguageMenu();
  });

  for (const button of languageButtons()) {
    button.addEventListener('click', () => {
      setLanguage(button.dataset.lang);
      saveLanguage(button.dataset.lang);
      closeLanguageMenu();
    });
  }

  elements.langOptions.addEventListener('keydown', (event) => {
    const buttons = languageButtons();
    const index = buttons.indexOf(document.activeElement);
    const moves = { ArrowDown: 1, ArrowUp: -1 };

    if (event.key in moves) {
      event.preventDefault();
      buttons[(index + moves[event.key] + buttons.length) % buttons.length].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      buttons[event.key === 'Home' ? 0 : buttons.length - 1].focus();
    } else if (event.key === 'Escape') {
      closeLanguageMenu();
    } else if (event.key === 'Tab') {
      closeLanguageMenu({ returnFocus: false });
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#lang-menu')) closeLanguageMenu({ returnFocus: false });
  });
}

function setUpRepoLinks() {
  for (const link of document.querySelectorAll('.repo-link')) link.href = config.repoUrl;

  const workshop = document.getElementById('workshop-link');
  workshop.href = config.contactEmail
    ? `mailto:${config.contactEmail}?subject=${encodeURIComponent('RedFlag workshop')}`
    : `${config.repoUrl}/issues`;
}

function init() {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    check();
  });

  elements.message.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      check();
    }
  });

  elements.message.addEventListener('input', () => {
    if (elements.message.value.trim() !== '') {
      elements.error.hidden = true;
      elements.pasteError.hidden = true;
    }
  });

  elements.clear.addEventListener('click', clear);
  elements.paste.addEventListener('click', pasteFromClipboard);
  elements.example.addEventListener('click', () => checkText(t('examples.3.text', state.lang)));

  setUpLanguageMenu();

  elements.footerFlag.addEventListener('click', () => effects.waveFlag(elements.flagWave));

  setUpRepoLinks();
  setUpTicker();
  drawStepArt();
  effects.setUpAccordions('.flag-item, .faq details');
  effects.setUpPress();

  const saved = readSavedLanguage();
  const supported = LANGUAGES.map((language) => language.code);
  setLanguage(supported.includes(saved) ? saved : pickLanguage(navigator.languages ?? [navigator.language]));

  // After the first render, so counters and reveals see the translated text.
  effects.setUpReveals();
  effects.setUpCounters();
  effects.setUpHeroGlow();

  setInterval(updateClock, 30_000);
}

init();
