export default [
  {
    id: 'job.too_good',
    category: 'job',
    severity: 'medium',
    weight: 20,
    patterns: {
      en: [
        'work from home',
        '(earn|make) \\$ ?\\d[\\d,]* (a|per|every) (day|week|hour)',
        'no experience (needed|required|necessary)',
        'hiring (now|immediately)',
        'easy money',
        'mystery shopper',
        'personal assistant (job|position)',
        'reship~ (packages|job)',
        '(cash|deposit) (a|the|this) check',
      ],
      uk: [
        'робот~ (з дому|вдома|на дому)',
        'заробіт~ від \\d',
        'заробля~ (від )?\\d',
        'досвід не (потрібен|обов\'язковий)',
        'легкі гроші',
      ],
      ru: [
        'работ~ (из дома|на дому)',
        'заработ~ от \\d',
        'зарабатыва~ (от )?\\d',
        'опыт не (нужен|требуется|обязателен)',
        'легкие деньги',
      ],
      es: [
        'trabaj(o|a|e) desde casa',
        'gan(a|e|ar) \\$ ?\\d[\\d,]* (al|por) (día|semana|hora)',
        'sin experiencia',
        'dinero fácil',
      ],
    },
  },
  {
    id: 'job.upfront_payment',
    category: 'job',
    severity: 'high',
    weight: 25,
    patterns: {
      en: [
        'pay (for )?(the |a )?(training|starter kit|registration|equipment|background check)',
        '(training|registration|starter kit|onboarding) fee',
      ],
      uk: ['оплат~ (навчання|реєстраці~|стартов~)'],
      ru: ['оплат~ (обучени~|регистраци~|стартов~)'],
      es: ['pag(ar|ue|a) (la |el )?(capacitación|registro|kit de inicio)'],
    },
  },
];
