import { drawArt } from './art.js';
import { combine } from './combine.js';
import config from './config.js';
import * as effects from './effects.js';
import { analyze } from './engine/index.js';
import { LANGUAGES, pickLanguage, t } from './i18n/index.js';

const LANG_KEY = 'redflag.lang';
const TEXT_SIZE_KEY = 'redflag.textSize';
const EXAMPLE_COUNT = 3;
const AI_TIMEOUT_MS = 30_000;
const PHONE_TIMEOUT_MS = 45_000;

const VERDICT_ICONS = {
  red: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M16.5 4h15L44 16.5v15L31.5 44h-15L4 31.5v-15L16.5 4Z" opacity=".22"/><path fill="none" stroke="currentColor" stroke-width="3" d="M16.5 4h15L44 16.5v15L31.5 44h-15L4 31.5v-15L16.5 4Z"/><path fill="currentColor" d="M22 13h4v15h-4zM22 32h4v4h-4z"/></svg>',
  yellow: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M24 5 45 42H3L24 5Z"/><path fill="currentColor" d="M22 18h4v13h-4zM22 34h4v4h-4z"/></svg>',
  green: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="m15 24.5 6 6 12-13"/></svg>',
  unknown: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" d="M18.5 18.5a5.5 5.5 0 1 1 7.7 5c-1.4.7-2.2 1.7-2.2 3.2v1"/><path fill="currentColor" d="M22 32h4v4h-4z"/></svg>',
  checking: '<svg class="verdict-spinner" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="4" opacity=".2"/><path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" d="M24 5a19 19 0 0 1 19 19"/></svg>',
};

const state = {
  lang: 'en',
  checkedText: null,
  // The AI answer belongs to one message, so it is kept with that message:
  // { status: 'loading' | 'done' | 'error', opinion?, messageKey? }.
  ai: null,
  // Result rows the visitor has opened for the current message.
  openRows: new Set(),
};

// The phone lookup is separate from the message check, with its own result.
const lookup = {
  status: null,
  number: null,
  result: null,
  errorKey: null,
  openRows: new Set(['ftc', 'web']),
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
  phoneSection: document.getElementById('phone'),
  phoneLink: document.getElementById('phone-link'),
  headerNumber: document.getElementById('header-number'),
  phoneForm: document.getElementById('phone-form'),
  phoneButton: document.getElementById('phone-button'),
  phoneInput: document.getElementById('phone-number'),
  phoneError: document.getElementById('phone-error'),
  phoneResult: document.getElementById('phone-result'),
  phoneAnnouncer: document.getElementById('phone-announcer'),
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
  renderPhone();
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

// A big labelled row that opens on tap. Which rows are open is remembered
// in `openRows`, so switching language or the AI answering doesn't fold
// them back up.
function resultRow(key, title, count, ...content) {
  return openableRow(state.openRows, key, title, count, ...content);
}

function openableRow(openRows, key, title, count, ...content) {
  const details = el('details', 'result-row');
  details.open = openRows.has(key);

  const summary = el('summary');
  summary.append(el('span', 'result-row-title', title));
  if (count !== undefined) summary.append(el('span', 'result-row-count', String(count)));

  const body = el('div', 'result-row-body');
  body.append(...content);
  details.append(summary, body);

  details.addEventListener('toggle', () => {
    if (details.open) openRows.add(key);
    else openRows.delete(key);
  });
  effects.attachAccordion(details);
  return details;
}

// While the AI reads the message, show that instead of a verdict, so nobody
// acts on a quick answer that is about to change.
function renderChecking({ announce }) {
  const { lang } = state;
  const verdict = el('div', 'verdict verdict-checking');
  verdict.insertAdjacentHTML('afterbegin', VERDICT_ICONS.checking);
  const copy = el('div');
  const heading = el('h2', 'verdict-title', t('ai.checking', lang));
  heading.id = 'result-title';
  copy.append(heading, el('p', 'verdict-summary', t('ai.checkingText', lang)));
  verdict.append(copy);

  elements.result.replaceChildren(verdict);
  elements.result.setAttribute('aria-labelledby', 'result-title');
  elements.result.hidden = false;
  if (announce) {
    elements.announcer.textContent = t('ai.checking', lang);
    effects.revealResult(elements.result);
  }
}

// The answer comes first: verdict, the one thing to do now, and two big
// buttons. Everything else waits behind rows, so nobody has to scroll
// through four screens to find out what to do.
function renderResult(text, { announce = true } = {}) {
  if (state.ai?.status === 'loading') {
    renderChecking({ announce });
    return;
  }

  const { lang } = state;
  const rules = analyze(text);
  const opinion = state.ai?.status === 'done' ? state.ai.opinion : null;
  const result = combine(rules, opinion);
  const verdictText = t(`result.verdict.${result.verdict}`, lang);
  // The AI explains this particular message, which beats a general summary.
  const summaryText = opinion?.explanation || t(`summary.${result.verdict}`, lang);
  const steps = [opinion?.advice, ...result.adviceKeys.map((key) => t(key, lang))].filter(Boolean);

  const verdict = el('div', `verdict verdict-${result.verdict}`);
  verdict.insertAdjacentHTML('afterbegin', VERDICT_ICONS[result.verdict]);
  const verdictCopy = el('div');
  const heading = el('h2', 'verdict-title', verdictText);
  heading.id = 'result-title';
  verdictCopy.append(heading, el('p', 'verdict-summary', summaryText));
  if (result.aiScore === null) {
    verdictCopy.append(el('p', 'verdict-score', t('result.score', lang, { score: result.ruleScore })));
    if (state.ai?.status === 'error') verdictCopy.append(el('p', 'verdict-note', t(state.ai.messageKey, lang)));
  } else {
    verdictCopy.append(scoreBars(result));
  }
  verdict.append(verdictCopy);

  const body = el('div', 'result-body');

  if (steps.length > 0) {
    const doFirst = el('div', `do-first do-first-${result.verdict}`);
    doFirst.append(el('p', 'do-first-label', t('result.doFirst', lang)), el('p', 'do-first-text', steps[0]));
    body.append(doFirst);
  }

  const tools = el('div', 'result-tools');
  if (speechAvailable()) tools.append(readAloudButton(steps, verdictText, summaryText));
  const again = el('button', 'btn btn-ghost btn-tool', t('result.again', lang));
  again.type = 'button';
  again.addEventListener('click', clear);
  tools.append(again);
  body.append(tools);

  const rows = el('div', 'result-rows');
  const reasons = uniqueByRule(rules.flags);
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
  for (const step of steps) advice.append(el('li', '', step));
  rows.append(resultRow('advice', t('result.adviceTitle', lang), steps.length, advice));

  if (rules.links.length > 0) {
    rows.append(resultRow('links', t('result.linksTitle', lang), rules.links.length, linkList(rules.links)));
  }

  rows.append(resultRow('message', t('result.yourMessage', lang), undefined, highlightedMessage(text, rules.highlights)));

  body.append(rows, el('p', 'result-disclaimer', t('result.disclaimer', lang)));

  elements.result.replaceChildren(verdict, body);
  elements.result.setAttribute('aria-labelledby', 'result-title');
  elements.result.hidden = false;

  if (announce) {
    elements.announcer.textContent = `${verdictText}. ${summaryText}`;
    effects.revealResult(elements.result);
  }
}

// Both scores, the AI's first because it leads the verdict.
function scoreBars({ aiScore, ruleScore }) {
  const { lang } = state;
  const list = el('div', 'verdict-scores');
  for (const [key, score, main] of [['result.scoreAi', aiScore, true], ['result.scoreRules', ruleScore, false]]) {
    const row = el('div', `score-row${main ? ' is-main' : ''}`);
    const bar = el('span', 'score-bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = el('span', 'score-fill');
    fill.style.width = `${score}%`;
    bar.append(fill);
    row.append(el('p', 'verdict-score', t(key, lang, { score })), bar);
    list.append(row);
  }
  return list;
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

function readAloudButton(steps, verdictText, summaryText) {
  const { lang } = state;
  const button = el('button', 'btn btn-primary btn-tool read-aloud');
  button.type = 'button';
  const label = el('span', '', t('result.readAloud', lang));
  button.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>');
  button.append(label);

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

// The AI check runs on every message alongside the rules. If it can't answer,
// the rules' answer stands on its own and says so.
async function askAi(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  let ai;

  try {
    const response = await fetch(config.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: state.lang }),
      signal: controller.signal,
    });
    if (response.status === 429 || response.status === 503) {
      ai = { status: 'error', messageKey: 'ai.busy' };
    } else if (!response.ok) {
      ai = { status: 'error', messageKey: 'ai.unavailable' };
    } else {
      ai = { status: 'done', opinion: await response.json() };
    }
  } catch {
    ai = { status: 'error', messageKey: navigator.onLine === false ? 'ai.offline' : 'ai.unavailable' };
  } finally {
    clearTimeout(timer);
  }

  // The visitor may have cleared or checked something else meanwhile.
  if (state.checkedText !== text) return;
  state.ai = ai;
  renderResult(text);
}

// Phone number lookup. The number leaves the device only when the visitor
// presses the button, and the Worker doesn't keep it.

// A first check here saves a trip to the server. The Worker checks again.
function phoneProblem(number) {
  if (number === '') return 'phone.empty';
  const digits = number.replace(/\D/g, '');
  if (/[^\d\s()+.\-]/.test(number) || digits.length < 8 || digits.length > 15) return 'phone.invalid';
  return null;
}

// `day` is YYYY-MM-DD. Noon UTC keeps it on that date in every time zone.
function formatDay(day) {
  return new Intl.DateTimeFormat(state.lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}

function ftcPanel(ftc) {
  const { lang } = state;
  const panel = el('div', 'phone-panel');

  if (ftc.status === 'not_us') {
    panel.append(el('p', '', t('phone.ftcUs', lang)));
  } else if (ftc.status !== 'done') {
    panel.append(el('p', '', t('phone.ftcUnavailable', lang)));
  } else if (ftc.count === 0) {
    panel.append(el('p', '', t('phone.ftcNone', lang)), el('p', 'phone-fine', t('phone.ftcNote', lang)));
  } else {
    panel.append(el('p', 'phone-strong', t('phone.ftcCount', lang, { count: ftc.count, date: formatDay(ftc.lastReported) })));
    if (ftc.subjects.length > 0) {
      const list = el('ul', 'link-issues');
      for (const slug of ftc.subjects) list.append(el('li', '', t(`phone.subject.${slug}`, lang)));
      panel.append(el('p', '', t('phone.ftcSubjects', lang)), list);
    }
    if (ftc.robocall) panel.append(el('p', '', t('phone.ftcRobocall', lang)));
    panel.append(el('p', 'phone-fine', t('phone.ftcNote', lang)));
  }
  return panel;
}

function webPanel(web) {
  const { lang } = state;
  const panel = el('div', 'phone-web');
  if (web.status !== 'done') {
    panel.append(el('p', '', t('phone.webUnavailable', lang)));
    return panel;
  }

  panel.append(
    el('span', `phone-pill phone-pill-${web.verdict}`, t(`phone.verdict.${web.verdict}`, lang)),
    el('p', 'phone-explanation', web.explanation),
  );
  if (web.advice) panel.append(el('p', 'phone-advice', `${t('phone.adviceLabel', lang)} ${web.advice}`));

  const sources = web.sources.filter((source) => source.url.startsWith('https://'));
  if (sources.length > 0) {
    const list = el('ul', 'phone-sources');
    for (const source of sources) {
      const link = el('a', '', source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const item = el('li');
      item.append(link);
      list.append(item);
    }
    panel.append(el('p', '', t('phone.webSources', lang)), list);
  }

  // Google asks that its search suggestions are shown with a search answer.
  // They arrive as ready-made HTML, so they go in a frame that can't run
  // scripts or touch the page.
  if (web.suggestions) {
    const frame = el('iframe', 'phone-suggestions');
    frame.title = t('phone.suggestions', lang);
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    frame.srcdoc = web.suggestions;
    panel.append(frame);
  }

  panel.append(el('p', '', t('phone.webDisclaimer', lang)));
  return panel;
}

// Same shape as a message result: the answer, the one thing to do, then
// the details. There is no green here. Finding nothing is not "safe".
function renderPhone() {
  const { lang } = state;
  const box = elements.phoneResult;

  elements.phoneError.textContent = lookup.errorKey ? t(lookup.errorKey, lang) : '';
  elements.phoneError.hidden = !lookup.errorKey;
  elements.phoneButton.disabled = lookup.status === 'loading';

  if (lookup.status === 'loading') {
    box.replaceChildren(el('p', 'phone-loading', t('phone.loading', lang)));
    box.removeAttribute('aria-labelledby');
    box.hidden = false;
    return null;
  }
  if (lookup.status !== 'done') {
    box.hidden = true;
    box.replaceChildren();
    return null;
  }

  const { result } = lookup;
  // FTC reports are about unwanted calls, which is not the same as a scam.
  // The page only says "scam" when the web search found scam reports too.
  const webSaysScam = result.web.status === 'done' && result.web.verdict === 'red';
  const wording = result.verdict === 'red' && !webSaysScam ? 'reported' : result.verdict;
  const verdictText = t(`phone.verdict.${wording}`, lang);
  const summaryText = t(`phone.summary.${wording}`, lang);
  const adviceText = t('phone.advice', lang);

  const verdict = el('div', `verdict verdict-${result.verdict}`);
  verdict.insertAdjacentHTML('afterbegin', VERDICT_ICONS[result.verdict]);
  const verdictCopy = el('div');
  const heading = el('h3', 'verdict-title', verdictText);
  heading.id = 'phone-result-title';
  verdictCopy.append(
    heading,
    el('p', 'verdict-summary', summaryText),
    el('p', 'verdict-score', t('phone.number', lang, { number: result.display })),
  );
  verdict.append(verdictCopy);

  const body = el('div', 'result-body');
  const doFirst = el('div', `do-first do-first-${result.verdict}`);
  doFirst.append(el('p', 'do-first-label', t('result.doFirst', lang)), el('p', 'do-first-text', adviceText));
  body.append(doFirst);

  const tools = el('div', 'result-tools');
  if (speechAvailable()) tools.append(readAloudButton([adviceText], verdictText, summaryText));
  const again = el('button', 'btn btn-ghost btn-tool', t('phone.again', lang));
  again.type = 'button';
  again.addEventListener('click', clearPhone);
  tools.append(again);
  body.append(tools);

  const rows = el('div', 'result-rows');
  const count = result.ftc.status === 'done' && result.ftc.count > 0 ? result.ftc.count : undefined;
  rows.append(
    openableRow(lookup.openRows, 'ftc', t('phone.ftcTitle', lang), count, ftcPanel(result.ftc)),
    openableRow(lookup.openRows, 'web', t('phone.webTitle', lang), undefined, webPanel(result.web)),
  );
  body.append(rows, el('p', 'result-disclaimer', `${t('phone.spoofing', lang)} ${t('phone.report', lang)}`));

  box.replaceChildren(verdict, body);
  box.setAttribute('aria-labelledby', 'phone-result-title');
  box.hidden = false;
  return { verdictText, summaryText };
}

async function lookUpNumber() {
  const number = elements.phoneInput.value.trim();
  stopReading();

  lookup.errorKey = phoneProblem(number);
  if (lookup.errorKey) {
    lookup.status = null;
    renderPhone();
    elements.phoneInput.focus();
    return;
  }

  Object.assign(lookup, { status: 'loading', number, result: null, openRows: new Set(['ftc', 'web']) });
  renderPhone();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHONE_TIMEOUT_MS);
  let errorKey = null;
  let result = null;

  try {
    const response = await fetch(config.lookupEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, lang: state.lang }),
      signal: controller.signal,
    });
    if (response.status === 400) errorKey = 'phone.invalid';
    else if (response.status === 429 || response.status === 503) errorKey = 'ai.busy';
    else if (!response.ok) errorKey = 'phone.error';
    else result = await response.json();
  } catch {
    errorKey = navigator.onLine === false ? 'ai.offline' : 'phone.error';
  } finally {
    clearTimeout(timer);
  }

  // The visitor cleared the box or started another lookup while this one ran.
  if (lookup.status !== 'loading' || lookup.number !== number) return;

  Object.assign(lookup, { status: result ? 'done' : null, result, errorKey });
  const shown = renderPhone();
  if (!shown) return;

  elements.phoneAnnouncer.textContent = `${shown.verdictText}. ${shown.summaryText}`;
  effects.revealResult(elements.phoneResult);
  elements.phoneResult.focus({ preventScroll: true });
  scrollPageTo(elements.phoneResult);
}

function clearPhone() {
  Object.assign(lookup, { status: null, number: null, result: null, errorKey: null });
  elements.phoneInput.value = '';
  elements.phoneAnnouncer.textContent = '';
  stopReading();
  renderPhone();
  elements.phoneInput.focus();
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
  state.ai = config.aiEndpoint ? { status: 'loading' } : null;
  state.openRows = new Set();
  stopReading();

  effects.scan(elements.field);
  renderResult(text);

  elements.result.tabIndex = -1;
  elements.result.focus({ preventScroll: true });
  scrollPageTo(elements.result);
  if (state.ai) askAi(text);
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

function focusNumber() {
  elements.phoneInput.focus({ preventScroll: true });
  scrollPageTo(elements.phoneSection);
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
  renderUsage();
}

// How many messages people have checked, from the Worker's daily counts.
// Stays hidden until the count is worth showing or if it can't be loaded.
let usage = null;

async function loadUsage() {
  if (!config.usageEndpoint) return;
  try {
    const response = await fetch(config.usageEndpoint);
    if (!response.ok) return;
    usage = await response.json();
    renderUsage();
  } catch {
    // Offline or not served by the Worker: leave the card hidden.
  }
}

function renderUsage() {
  const card = document.getElementById('stat-usage');
  if (!usage || usage.checked < config.usageMinToShow) {
    card.hidden = true;
    return;
  }
  const { lang } = state;
  document.getElementById('stat-usage-checked').textContent = usage.checked.toLocaleString(lang);
  document.getElementById('stat-usage-warned').textContent = t('stats.usage.warned', lang, { count: usage.warned.toLocaleString(lang) });
  card.hidden = false;
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

  // "Check a message" and "Check a number" should land the cursor in the
  // box, not just near it.
  for (const link of document.querySelectorAll('.focus-message')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      focusMessage();
    });
  }
  for (const link of document.querySelectorAll('.focus-number')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      focusNumber();
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

  // The phone lookup needs the Worker.
  elements.phoneSection.hidden = !config.lookupEndpoint;
  elements.phoneLink.hidden = !config.lookupEndpoint;
  elements.headerNumber.hidden = !config.lookupEndpoint;
  elements.phoneForm.addEventListener('submit', (event) => {
    event.preventDefault();
    lookUpNumber();
  });
  elements.phoneInput.addEventListener('input', () => {
    if (!lookup.errorKey) return;
    lookup.errorKey = null;
    elements.phoneError.hidden = true;
  });

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
  loadUsage();
}

init();
