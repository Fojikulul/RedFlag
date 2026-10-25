// "Work from home" on its own is an everyday phrase. Promised pay for no
// experience is what makes a job offer suspicious.
export default [
  {
    id: 'job.remote_offer',
    category: 'job',
    severity: 'low',
    weight: 10,
    patterns: {
      en: ['work from home', 'hiring (now|immediately)', 'part-time job'],
      uk: ['робот~ (з дому|вдома|на дому)', 'віддален~ робот~'],
      ru: ['работ~ (из дома|на дому)', 'удаленн~ работ~'],
      es: ['trabaj(o|a|e) desde casa', 'trabajo remoto'],
    },
  },
  {
    id: 'job.too_good',
    category: 'job',
    severity: 'medium',
    weight: 25,
    patterns: {
      en: [
        '(earn|make) \\$ ?\\d[\\d,]* (a|per|every) (day|week|hour)',
        'no experience (needed|required|necessary)',
        'easy money',
        'mystery shopper',
        'personal assistant (job|position)',
        'reship~ (packages|job)',
        '(cash|deposit) (a|the|this) check',
      ],
      uk: [
        'заробіт~ від \\d',
        'заробля~ (від )?\\d',
        'досвід не (потрібен|обов\'язковий)',
        'легкі гроші',
      ],
      ru: [
        'заработ~ от \\d',
        'зарабатыва~ (от )?\\d',
        'опыт не (нужен|требуется|обязателен)',
        'легкие деньги',
      ],
      es: [
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
