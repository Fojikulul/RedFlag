import { drawArt } from './art.js';
import config from './config.js';
import * as effects from './effects.js';
import { analyze } from './engine/index.js';
import { LANGUAGES, pickLanguage, t } from './i18n/index.js';

const LANG_KEY = 'redflag.lang';
const TEXT_SIZE_KEY = 'redflag.textSize';
const EXAMPLE_COUNT = 3;
const AI_TIMEOUT_MS = 30_000;

const VERDICT_ICONS = {
  red: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M16.5 4h15L44 16.5v15L31.5 44h-15L4 31.5v-15L16.5 4Z" opacity=".22"/><path fill="none" stroke="currentColor" stroke-width="3" d="M16.5 4h15L44 16.5v15L31.5 44h-15L4 31.5v-15L16.5 4Z"/><path fill="currentColor" d="M22 13h4v15h-4zM22 32h4v4h-4z"/></svg>',
  yellow: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M24 5 45 42H3L24 5Z"/><path fill="currentColor" d="M22 18h4v13h-4zM22 34h4v4h-4z"/></svg>',
  green: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="m15 24.5 6 6 12-13"/></svg>',
};

const state = {
  lang: 'en',
  checkedText: null,
  // The AI answer belongs to one message, so it is kept with that message.
  ai: null,
  // Result rows the visitor has opened for the current message.
  openRows: new Set(),
};

const elements = {
  form: document.getElementById('check-form'),
  message: document.getElementById('message'),
  field: document.querySelector('.tool-field'),
  error: document.getElementById('tool-error'),
  clear: document.getElementById('clear-button'),
  paste: document.getElementById('paste-button'),
  pasteError: document.getElementById('paste-error'),
  example: document.getElementById('example-button'),
  result: document.getElementById('result'),
  announcer: document.getElementById('result-announcer'),
  examples: document.getElementById('example-cards'),
  localTime: document.getElementById('local-time'),
  localZone: document.getElementById('local-zone'),
  textSize: document.getElementById('text-size'),
  langToggle: document.getElementById('lang-toggle'),
  langOptions: document.getElementById('lang-options'),
  langCurrent: document.getElementById('lang-current'),
  localAgency: document.getElementById('local-agency-link'),
  footerFlag: document.getElementById('footer-flag'),
  flagWave: document.getElementById('flag-wave'),
};

// localStorage throws in some private-browsing modes. The page still works,
// it just won't remember the settings.
function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; nothing depends on it.
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

  stopReading();
  renderStats();
  renderExamples();
  renderQuiz();
  renderLocalAgency();
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

// A big labelled row that opens on tap. Which rows are open is remembered,
// so switching language or asking the AI doesn't fold them back up.
function resultRow(key, title, count, ...content) {
  const details = el('details', 'result-row');
  details.open = state.openRows.has(key);

  const summary = el('summary');
  summary.append(el('span', 'result-row-title', title));
  if (count !== undefined) summary.append(el('span', 'result-row-count', String(count)));

  const body = el('div', 'result-row-body');
  body.append(...content);
  details.append(summary, body);

  details.addEventListener('toggle', () => {
    if (details.open) state.openRows.add(key);
    else state.openRows.delete(key);
  });
  effects.attachAccordion(details);
  return details;
}

// The answer comes first: verdict, the one thing to do now, and two big
// buttons. Everything else waits behind rows, so nobody has to scroll
// through four screens to find out what to do.
function renderResult(text, { announce = true } = {}) {
  const { lang } = state;
  const result = analyze(text);
  const verdictText = t(`result.verdict.${result.verdict}`, lang);
  const summaryText = t(result.summaryKey, lang);

  // When the rules see nothing, a second look matters most, so offer it open.
  if (announce && result.verdict === 'green' && config.aiEndpoint) state.openRows.add('ai');

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

  if (result.adviceKeys.length > 0) {
    const doFirst = el('div', `do-first do-first-${result.verdict}`);
    doFirst.append(el('p', 'do-first-label', t('result.doFirst', lang)), el('p', 'do-first-text', t(result.adviceKeys[0], lang)));
    body.append(doFirst);
  }

  const tools = el('div', 'result-tools');
  if (speechAvailable()) tools.append(readAloudButton(result, verdictText, summaryText));
  const again = el('button', 'btn btn-ghost btn-tool', t('result.again', lang));
  again.type = 'button';
  again.addEventListener('click', clear);
  tools.append(again);
  body.append(tools);

  const rows = el('div', 'result-rows');
  const reasons = uniqueByRule(result.flags);
  if (reasons.length > 0) {
    const list = el('ul', 'flag-reasons');
    for (const flag of reasons) {
      const item = el('li', 'flag-reason');
      item.append(
        el('span', 'tag', t(`category.${flag.category}`, lang)),
        el('p', '', t(flag.explanationKey, lang)),
        el('p', 'flag-found', t('result.matched', lang, { match: flag.matches.map((m) => `“${m}”`).join(', ') })),
      );
      list.append(item);
    }
    rows.append(resultRow('why', t('result.flagsTitle', lang), reasons.length, list));
  }

  const advice = el('ol', 'advice');
  for (const key of result.adviceKeys) advice.append(el('li', '', t(key, lang)));
  rows.append(resultRow('advice', t('result.adviceTitle', lang), result.adviceKeys.length, advice));

  if (result.links.length > 0) {
    rows.append(resultRow('links', t('result.linksTitle', lang), result.links.length, linkList(result.links)));
  }

  rows.append(resultRow('message', t('result.yourMessage', lang), undefined, highlightedMessage(text, result.highlights)));

  if (config.aiEndpoint) {
    const title = t(result.verdict === 'green' ? 'ai.titleGreen' : 'ai.title', lang);
    rows.append(resultRow('ai', title, undefined, aiPanel()));
  }

  body.append(rows, el('p', 'result-disclaimer', t('result.disclaimer', lang)));

  elements.result.replaceChildren(verdict, body);
  elements.result.setAttribute('aria-labelledby', 'result-title');
  elements.result.hidden = false;

  if (announce) {
    elements.announcer.textContent = `${verdictText}. ${summaryText}`;
    effects.revealResult(elements.result);
  }
}

// Read it to me: the verdict and what to do, spoken by the device. Only our
// own wording is read out, never the pasted message, because some system
// voices send text to an online service.
const SPEECH_LANGS = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU', es: 'es-ES' };

function speechAvailable() {
  if (!('speechSynthesis' in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  // Voices load late in some browsers; an empty list means "not known yet".
  return voices.length === 0 || voices.some((voice) => voice.lang.toLowerCase().startsWith(state.lang));
}

function stopReading() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function readAloudButton(result, verdictText, summaryText) {
  const { lang } = state;
  const button = el('button', 'btn btn-primary btn-tool read-aloud');
  button.type = 'button';
  const label = el('span', '', t('result.readAloud', lang));
  button.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>');
  button.append(label);

  const steps = result.adviceKeys.map((key) => t(key, lang));
  const script = [verdictText, summaryText, `${t('result.adviceTitle', lang)}:`, ...steps].join(' ');

  button.addEventListener('click', () => {
    if (window.speechSynthesis.speaking) {
      stopReading();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = SPEECH_LANGS[lang];
    utterance.rate = 0.9;
    const reset = () => {
      label.textContent = t('result.readAloud', state.lang);
      button.setAttribute('aria-pressed', 'false');
    };
    utterance.onend = reset;
    utterance.onerror = reset;
    label.textContent = t('result.stopReading', lang);
    button.setAttribute('aria-pressed', 'true');
    window.speechSynthesis.speak(utterance);
  });
  button.setAttribute('aria-pressed', 'false');
  return button;
}

// Each web address in the message, and what is wrong with it in plain words.
function linkList(links) {
  const list = el('ul', 'link-list');
  for (const link of links) {
    const item = el('li', 'link-item');
    item.append(el('p', 'link-domain', link.domain), el('p', 'link-url', link.url));

    if (link.issues.length === 0) {
      item.append(el('p', 'link-clean', t('result.linkClean', state.lang)));
    } else {
      const issues = el('ul', 'link-issues');
      for (const issue of link.issues) issues.append(el('li', '', t(`explain.links.${issue}`, state.lang)));
      item.append(issues);
    }
    list.append(item);
  }
  return list;
}

// "Can you spot the scam?": four messages, answer, see why.
const QUIZ_ANSWERS = ['scam', 'safe', 'scam', 'safe'];
const quiz = { index: 0, score: 0, answer: null };

function renderQuiz() {
  const { lang } = state;
  const card = document.getElementById('quiz-card');
  const total = QUIZ_ANSWERS.length;

  if (quiz.index >= total) {
    const again = el('button', 'btn btn-primary', t('quiz.again', lang));
    again.type = 'button';
    again.addEventListener('click', () => {
      Object.assign(quiz, { index: 0, score: 0, answer: null });
      renderQuiz();
    });
    card.replaceChildren(
      el('p', 'quiz-score', t('quiz.score', lang, { score: quiz.score, total })),
      el('p', 'quiz-note', t('quiz.scoreNote', lang)),
      again,
    );
    return;
  }

  const n = quiz.index + 1;
  const correct = QUIZ_ANSWERS[quiz.index];
  const children = [
    el('p', 'quiz-progress', t('quiz.progress', lang, { n, total })),
    el('div', 'message-view quiz-message', t(`quiz.${n}.text`, lang)),
  ];

  if (quiz.answer === null) {
    children.push(el('p', 'quiz-question', t('quiz.question', lang)));
    const choices = el('div', 'quiz-choices');
    for (const choice of ['scam', 'safe']) {
      const button = el('button', 'btn btn-ghost btn-large', t(`quiz.${choice}`, lang));
      button.type = 'button';
      button.addEventListener('click', () => {
        quiz.answer = choice;
        if (choice === correct) quiz.score++;
        renderQuiz();
        card.querySelector('.quiz-next')?.focus({ preventScroll: true });
      });
      choices.append(button);
    }
    children.push(choices);
  } else {
    const right = quiz.answer === correct;
    const feedback = el('div', `quiz-feedback ${right ? 'is-right' : 'is-wrong'}`);
    feedback.append(
      el('p', 'quiz-verdict', `${t(right ? 'quiz.right' : 'quiz.wrong', lang)} ${t(correct === 'scam' ? 'quiz.isScam' : 'quiz.isSafe', lang)}`),
      el('p', '', t(`quiz.${n}.why`, lang)),
    );
    const next = el('button', 'btn btn-primary quiz-next', t(n === total ? 'quiz.finish' : 'quiz.next', lang));
    next.type = 'button';
    next.addEventListener('click', () => {
      quiz.index++;
      quiz.answer = null;
      renderQuiz();
    });
    children.push(feedback, next);
  }

  card.replaceChildren(...children);
}

// AI second opinion. Opt-in per message, because it is the one time the
// text leaves the device.

function aiPanel() {
  const { lang } = state;
  const panel = el('section', 'ai-panel');
  panel.setAttribute('aria-live', 'polite');

  if (state.ai?.status === 'loading') {
    panel.append(el('p', 'ai-loading', t('ai.loading', lang)));
    return panel;
  }

  if (state.ai?.status === 'done') {
    const { opinion } = state.ai;
    panel.append(
      el('h3', '', t('ai.resultTitle', lang)),
      el('span', `ai-verdict ai-verdict-${opinion.verdict}`, t(`ai.verdict.${opinion.verdict}`, lang)),
      el('p', 'ai-explanation', opinion.explanation),
    );
    if (opinion.advice) {
      const advice = el('p', 'ai-advice');
      advice.append(`${t('ai.adviceLabel', lang)} ${opinion.advice}`);
      panel.append(advice);
    }
    panel.append(el('p', '', t('ai.disclaimer', lang)));
    return panel;
  }

  panel.append(el('p', '', t('ai.text', lang)));
  if (state.ai?.status === 'error') panel.append(el('p', 'tool-error', t(state.ai.messageKey, lang)));

  const button = el('button', 'btn btn-primary', t('ai.button', lang));
  button.type = 'button';
  button.addEventListener('click', askAi);
  panel.append(button);
  return panel;
}

async function askAi() {
  const text = state.checkedText;
  if (text === null) return;

  state.ai = { status: 'loading' };
  renderResult(text, { announce: false });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(config.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: state.lang }),
      signal: controller.signal,
    });
    if (state.checkedText !== text) return;

    if (response.status === 429 || response.status === 503) {
      state.ai = { status: 'error', messageKey: 'ai.busy' };
    } else if (!response.ok) {
      state.ai = { status: 'error', messageKey: 'ai.error' };
    } else {
      state.ai = { status: 'done', opinion: await response.json() };
    }
  } catch {
    if (state.checkedText !== text) return;
    state.ai = { status: 'error', messageKey: navigator.onLine === false ? 'ai.offline' : 'ai.error' };
  } finally {
    clearTimeout(timer);
  }

  renderResult(text, { announce: false });
  if (state.ai.status === 'done') {
    const { opinion } = state.ai;
    elements.announcer.textContent = `${t('ai.resultTitle', state.lang)}: ${t(`ai.verdict.${opinion.verdict}`, state.lang)}. ${opinion.explanation}`;
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
  elements.pasteError.hidden = true;
  state.checkedText = text;
  state.ai = null;
  state.openRows = new Set();
  stopReading();

  effects.scan(elements.field);
  renderResult(text);

  elements.result.tabIndex = -1;
  elements.result.focus({ preventScroll: true });
  scrollPageTo(elements.result);
}

// Scrolls the window itself. scrollIntoView can also scroll any clipped
// ancestor, which leaves content stuck where the visitor can't scroll back.
function scrollPageTo(element) {
  const header = document.querySelector('.site-header').offsetHeight;
  const top = element.getBoundingClientRect().top + window.scrollY - header - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
}

function clear() {
  elements.message.value = '';
  elements.error.hidden = true;
  elements.pasteError.hidden = true;
  elements.result.hidden = true;
  elements.result.replaceChildren();
  elements.announcer.textContent = '';
  state.checkedText = null;
  state.ai = null;
  state.openRows = new Set();
  stopReading();
  focusMessage();
}

function focusMessage() {
  elements.message.focus({ preventScroll: true });
  scrollPageTo(document.getElementById('checker'));
}

// Reading the clipboard happens on the device, like the check itself. Some
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

function renderLocalAgency() {
  const { name, phone } = config.localAgency;
  const link = elements.localAgency;
  link.hidden = !(name && phone);
  if (link.hidden) return;
  link.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  link.textContent = `${t('report.local.button', state.lang, { name })} · ${phone}`;
}

// The visitor's own time zone, named in the page language ("Eastern Time",
// "Восточное время"). Comes from the browser, so no location is asked for.
function localZone() {
  for (const style of ['longGeneric', 'long']) {
    try {
      const parts = new Intl.DateTimeFormat(state.lang, { timeZoneName: style }).formatToParts(new Date());
      const name = parts.find((part) => part.type === 'timeZoneName')?.value;
      if (name) return name;
    } catch {
      // Older browsers don't know "longGeneric"; try the next style.
    }
  }
  return t('nav.localTime', state.lang);
}

function updateClock() {
  elements.localZone.textContent = localZone();
  const time = new Date();
  elements.localTime.dateTime = time.toISOString();
  elements.localTime.textContent = new Intl.DateTimeFormat(state.lang, { hour: 'numeric', minute: '2-digit' }).format(time);
}

function setTextSize(large) {
  document.documentElement.classList.toggle('text-large', large);
  elements.textSize.setAttribute('aria-pressed', String(large));
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
      saveSetting(LANG_KEY, button.dataset.lang);
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

function setUpLinks() {
  for (const link of document.querySelectorAll('.repo-link')) link.href = config.repoUrl;

  const workshop = document.getElementById('workshop-link');
  workshop.href = config.contactEmail
    ? `mailto:${config.contactEmail}?subject=${encodeURIComponent('RedFlag workshop')}`
    : `${config.repoUrl}/issues`;

  // "Check a message" should land the cursor in the box, not just near it.
  for (const link of document.querySelectorAll('.focus-message')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      focusMessage();
    });
  }
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
  elements.textSize.addEventListener('click', () => {
    const large = elements.textSize.getAttribute('aria-pressed') !== 'true';
    setTextSize(large);
    saveSetting(TEXT_SIZE_KEY, large ? 'large' : 'normal');
  });
  elements.footerFlag.addEventListener('click', () => effects.waveFlag(elements.flagWave));

  document.getElementById('year').textContent = String(new Date().getFullYear());
  setUpLanguageMenu();
  setUpLinks();
  drawArt();
  effects.setUpAccordions('.flag-item, .faq details');
  effects.setUpPress();

  setTextSize(readSetting(TEXT_SIZE_KEY) === 'large');
  const saved = readSetting(LANG_KEY);
  const supported = LANGUAGES.map((language) => language.code);
  setLanguage(supported.includes(saved) ? saved : pickLanguage(navigator.languages ?? [navigator.language]));

  // After the first render, so counters and reveals see the translated text.
  effects.setUpReveals();
  effects.setUpCounters();
  effects.setUpStepArt();
  effects.setUpWordmark(elements.footerFlag);

  setInterval(updateClock, 30_000);
}

init();
