export default [
  {
    id: 'investment.guaranteed_returns',
    category: 'investment-romance',
    severity: 'high',
    weight: 25,
    patterns: {
      en: [
        'guaranteed (return|returns|profit|profits|income)',
        'double your (money|investment)',
        'risk-?free (investment|profit|returns?)',
        '\\d+% (daily|weekly|monthly) (return|profit)',
        'trading platform',
        'investment opportunity',
        'passive income',
        '\\d+x (any|your|all) (bitcoin|crypto|btc|eth)',
        'we(\'ll| will) send (you )?back',
        'crypto(currency)? (promotion|giveaway|fundraising)',
      ],
      uk: [
        'гарантован~ (дохід|прибут~|дохідн~)',
        'подвої~ (гроші|вклад|інвестиці~)',
        'без ризику',
        'торгов~ платформ~',
        'інвестиційн~ (можливість|проєкт~|проект~)',
        'пасивн~ дохід',
      ],
      ru: [
        'гарантированн~ (доход~|прибыл~|доходност~)',
        'удвои~ (деньги|вклад|инвестици~)',
        'без риска',
        'торгов~ платформ~',
        'инвестиционн~ (возможност~|проект~)',
        'пассивн~ доход',
      ],
      es: [
        '(rendimientos?|ganancias?) garantizad~',
        'duplic(ar|a|e) (su|tu) (dinero|inversión)',
        'sin riesgo',
        'plataforma de (trading|inversión)',
        'oportunidad de inversión',
        'ingresos pasivos',
      ],
    },
  },
  {
    // "Hey is this John? We met on Tinder" starts a long romance or
    // investment scam with a stranger who "texted the wrong number".
    id: 'romance.wrong_number',
    category: 'investment-romance',
    severity: 'medium',
    weight: 25,
    patterns: {
      en: [
        'we (chatted|talked|matched|met) on (tinder|facebook|instagram|whatsapp|bumble|hinge|linkedin)',
        'sorry,? (wrong number|i think i have the wrong number)',
      ],
      uk: ['ми спілкувал~ (в|у) (тіндері|фейсбуці|інстаграмі)'],
      ru: ['мы общал~ (в|на) (тиндере|фейсбуке|инстаграме)'],
      es: ['hablamos (en|por) (tinder|facebook|instagram)'],
    },
  },
  {
    id: 'romance.money_request',
    category: 'investment-romance',
    severity: 'medium',
    weight: 20,
    patterns: {
      en: [
        'stuck (overseas|abroad|at the airport)',
        '(plane|flight) ticket',
        'visa fee',
        'customs (is holding|are holding|fee)',
        'can you (help me with|lend me|send me) (some )?money',
        '(soldier|military|army|marine|peacekeeper) _ (syria|afghanistan|iraq|yemen|overseas|abroad|deployed)',
        'oil rig',
      ],
      uk: [
        'квит~ на літак',
        'застряг~? (за кордоном|в аеропорту)',
        'позич~ (мені )?гроші',
        'можеш (позичити|скинути|переказати)',
      ],
      ru: [
        'билет~ на самол[её]т',
        'застрял~? (за границей|в аэропорту)',
        'одолжи~ (мне )?деньг~',
        'можешь (одолжить|скинуть|перевести)',
      ],
      es: [
        'boleto de avión',
        'atrapad~ en el (aeropuerto|extranjero)',
        'préstame dinero',
        'puedes (enviarme|prestarme|mandarme) dinero',
      ],
    },
  },
];
