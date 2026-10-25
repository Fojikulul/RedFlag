import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyze, getSupportedLanguages, MAX_LENGTH, mergeSpans } from '../js/engine/index.js';

const DEMO = {
  en: 'Your Social Security number has been suspended. Call immediately or face arrest. Pay $500 in gift cards to resolve.',
  uk: 'Ваш номер соціального страхування заблоковано. Негайно зателефонуйте, інакше вас заарештують. Сплатіть $500 подарунковими картками, щоб усе владнати.',
  ru: 'Ваш номер социального страхования заблокирован. Немедленно позвоните, иначе вас арестуют. Оплатите $500 подарочными картами, чтобы всё уладить.',
  es: 'Su número de Seguro Social ha sido suspendido. Llame inmediatamente o enfrentará un arresto. Pague $500 en tarjetas de regalo para resolverlo.',
};

const CORE_SCAMS = {
  'IRS impersonation': {
    en: 'IRS notice: you owe $1,240 in back taxes. A warrant has been issued for your arrest. Pay today to avoid prosecution.',
    uk: 'Податкова служба: у вас заборгованість 12 400 грн. Якщо не сплатите сьогодні, справу передадуть до суду і вас заарештують.',
    ru: 'Налоговая служба: у вас задолженность 45 000 руб. Если не оплатите сегодня, на вас заведут уголовное дело.',
    es: 'Servicio de impuestos: usted debe $1,240. Se ha emitido una orden de arresto en su contra. Pague hoy para evitar un proceso judicial.',
  },
  'Gift card request': {
    en: 'Hi, it is your pastor. I need a favor today. Can you buy four Google Play gift cards and send me the codes on the back? Keep this between us.',
    uk: 'Добрий день, це ваш керівник. Терміново купіть 5 подарункових карток Google Play і надішліть мені коди. Нікому не кажіть.',
    ru: 'Здравствуйте, это ваш начальник. Срочно купите 5 подарочных карт Google Play и пришлите мне коды. Никому не говорите.',
    es: 'Hola, soy tu jefe. Necesito que compres urgente 5 tarjetas de regalo de Google Play y me envíes los códigos. No le digas a nadie.',
  },
  'Fake bank alert': {
    en: 'Chase Alert: Your account has been locked due to suspicious activity. Verify your identity at http://chase-secure-verify.top within 24 hours.',
    uk: 'ПриватБанк: ваша картка заблокована через підозрілі операції. Підтвердіть особу за посиланням privatbank-verify.top протягом 24 годин.',
    ru: 'Сбербанк: ваша карта заблокирована из-за подозрительных операций. Подтвердите личность по ссылке sberbank-verify.top в течение 24 часов.',
    es: 'BBVA: su cuenta ha sido bloqueada por actividad sospechosa. Verifique su identidad en http://bbva-seguridad.top en las próximas 24 horas.',
  },
  'Grandchild scam': {
    en: "Grandma, it's me. I'm in jail and need $2,000 for bail. Please don't tell mom and dad. Can you send it by Western Union?",
    uk: 'Бабусю, це я. Я потрапив у ДТП, мене затримали. Потрібні гроші на адвоката, 40 000 грн. Тільки не кажи мамі. Передай кур\'єру.',
    ru: 'Бабушка, это я. Я попал в ДТП, меня задержали. Нужны деньги на адвоката, 100 000 рублей. Только не говори маме. Передай курьеру.',
    es: 'Abuela, soy yo. Tuve un accidente y me detuvieron. Necesito $2,000 para la fianza. Por favor no le digas a mamá.',
  },
  'Phishing link': {
    en: 'USPS: Your package is on hold due to an incomplete address. Update your delivery address within 24 hours: http://usps-redelivery.click/track',
    uk: 'Нова Пошта: посилку затримано через неповну адресу. Оновіть дані доставки протягом 24 годин: http://novaposhta-dostavka.click',
    ru: 'Почта России: посылка задержана из-за неполного адреса. Обновите данные доставки в течение 24 часов: http://pochta-dostavka.click',
    es: 'Correos: su paquete está retenido por una dirección incompleta. Actualice sus datos en las próximas 24 horas: http://correos-entrega.click',
  },
};

const SAFE = [
  ['en', 'Running 10 min late, see you soon'],
  ['en', 'Your Amazon order has shipped and will arrive Thursday.'],
  ['en', 'Reminder: you have an appointment with Dr. Patel on Tuesday at 2:30 PM. Reply C to confirm.'],
  ['en', "Your verification code is 482913. Don't share this code with anyone."],
  ['uk', 'Привіт! Вечеря в неділю о шостій, приходьте всі разом. Я спечу пиріг.'],
  ['ru', 'Мам, я уже дома. Завтра заеду к вам после работы, купить что-нибудь?'],
  ['es', 'Hola mamá, ya llegué. Mañana te llamo para lo de la cena del domingo.'],
];

test('demo message is red with at least three flags in every language', () => {
  for (const [lang, text] of Object.entries(DEMO)) {
    const result = analyze(text);
    assert.equal(result.verdict, 'red', `${lang}: ${result.score}`);
    assert.ok(new Set(result.flags.map((flag) => flag.ruleId)).size >= 3, lang);
  }
});

for (const [name, versions] of Object.entries(CORE_SCAMS)) {
  test(`${name} is red in every language`, () => {
    for (const [lang, text] of Object.entries(versions)) {
      const result = analyze(text);
      const fired = result.flags.map((flag) => flag.ruleId).join(', ');
      assert.equal(result.verdict, 'red', `${lang} scored ${result.score}: ${fired}`);
    }
  });
}

test('everyday messages stay green', () => {
  for (const [lang, text] of SAFE) {
    const result = analyze(text);
    const fired = result.flags.map((flag) => flag.ruleId).join(', ');
    assert.equal(result.verdict, 'green', `${lang} "${text}" scored ${result.score}: ${fired}`);
  }
});

test('empty and whitespace input is green without flags', () => {
  for (const input of ['', '   \n\t', undefined, null, 42]) {
    const result = analyze(input);
    assert.equal(result.verdict, 'green');
    assert.equal(result.score, 0);
    assert.deepEqual(result.flags, []);
  }
});

test('only analyzes the first MAX_LENGTH characters', () => {
  const text = `${'a'.repeat(MAX_LENGTH)} gift cards`;
  assert.deepEqual(analyze(text).flags, []);
});

test('flag offsets point at the original text', () => {
  const text = 'Hello!!  Please   PAY with GIFT​ CARDS today.';
  for (const flag of analyze(text).flags) {
    assert.equal(text.slice(flag.start, flag.end), flag.match);
  }
  const giftCard = analyze(text).flags.find((flag) => flag.ruleId === 'payment.gift_card');
  assert.equal(giftCard.match, 'GIFT​ CARDS');
});

test('each rule counts once toward the score', () => {
  const once = analyze('Buy gift cards.').score;
  const many = analyze('Buy gift cards. Gift cards! More gift cards, gift cards.').score;
  assert.equal(once, many);
});

test('a bare suspicious link is at least yellow', () => {
  assert.notEqual(analyze('bit.ly/3xYzAb').verdict, 'green');
  assert.notEqual(analyze('http://192.168.0.7/login').verdict, 'green');
});

test('mixed-script words are flagged as look-alikes', () => {
  const result = analyze('Pаypal: your account is limited'); // Cyrillic "а"
  assert.ok(result.flags.some((flag) => flag.ruleId === 'impersonation.homoglyph'));
});

test('detects the message language', () => {
  assert.equal(analyze(DEMO.en).detectedLanguage, 'en');
  assert.equal(analyze(DEMO.uk).detectedLanguage, 'uk');
  assert.equal(analyze(DEMO.ru).detectedLanguage, 'ru');
  assert.equal(analyze(DEMO.es).detectedLanguage, 'es');
  assert.equal(analyze(DEMO.en, { lang: 'es' }).detectedLanguage, 'es');
});

test('returns summary and advice keys', () => {
  const red = analyze(DEMO.en);
  assert.equal(red.summaryKey, 'summary.red');
  assert.ok(red.adviceKeys.includes('advice.do_not_pay'));
  assert.equal(red.adviceKeys.at(-1), 'advice.report');
  assert.deepEqual(analyze('See you at 6').adviceKeys, ['advice.stay_careful']);
});

test('highlight spans never overlap', () => {
  const spans = analyze('Pay with gift cards at http://gift-cards.top today').highlights;
  for (let i = 1; i < spans.length; i++) {
    assert.ok(spans[i].start >= spans[i - 1].end);
  }
});

test('mergeSpans joins overlapping flags and keeps their rule ids', () => {
  const merged = mergeSpans([
    { ruleId: 'a', start: 0, end: 5 },
    { ruleId: 'b', start: 3, end: 8 },
    { ruleId: 'c', start: 10, end: 12 },
  ]);
  assert.deepEqual(merged, [
    { start: 0, end: 8, ruleIds: ['a', 'b'] },
    { start: 10, end: 12, ruleIds: ['c'] },
  ]);
});

test('exposes the supported languages', () => {
  assert.deepEqual(getSupportedLanguages(), ['en', 'uk', 'ru', 'es']);
});
