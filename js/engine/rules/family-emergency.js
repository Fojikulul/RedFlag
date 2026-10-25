export default [
  {
    id: 'family.relative_in_trouble',
    category: 'family-emergency',
    severity: 'high',
    weight: 30,
    patterns: {
      en: [
        '(grandma|grandpa|grandmother|grandfather|nana|mom|mum|dad),? (it\'s|its|this is) me',
        '(it\'s|this is) your (grandson|granddaughter|nephew|niece|son|daughter)',
        '(i\'m|i am|i was|i got) (in jail|in the hospital|arrested|in trouble|in an accident|stuck)',
        'i\'ve been arrested',
        'need (money|cash|\\$ ?\\d[\\d,]*) (for|to pay) (bail|a lawyer|the lawyer|the hospital|the fine)',
        'bail (money)?',
      ],
      uk: [
        '(бабусю|дідусю|мамо|мам|тату|тато),? це я',
        'це (ваш|твій) (онук|син|племінник|онука|донька)',
        '(я|потрапив|потрапила) (в|у) (лікарн~|поліці~|аварі~|біду|дтп)',
        'мене (затримали|заарештували)',
        'потрібн~ гроші (на|для) (адвокат~|лікуванн~|лікарн~|застав~)',
        'я в біді',
      ],
      ru: [
        '(бабушка|дедушка|мама|папа),? это я',
        'это (ваш|твой) (внук|сын|племянник|внучка|дочь)',
        '(я|попал|попала) в (больниц~|полици~|аварию|беду|дтп)',
        'меня (задержали|арестовали)',
        'нужны деньги (на|для) (адвокат~|лечени~|больниц~|залог~)',
        'я в беде',
      ],
      es: [
        '(abuela|abuelo|mamá|papá),? soy yo',
        'soy tu (nieto|nieta|hijo|hija|sobrino|sobrina)',
        'estoy en (la cárcel|el hospital|problemas)',
        'me (arrestaron|detuvieron)',
        'tuve un accidente',
        'necesito (dinero|\\$ ?\\d[\\d,]*) para (la fianza|el abogado|un abogado|el hospital)',
        'fianza',
      ],
    },
  },
  {
    // "Hi mum, new number" is the opener of a whole family of scams, so it
    // is worth a yellow on its own.
    id: 'family.new_number',
    category: 'family-emergency',
    severity: 'medium',
    weight: 25,
    patterns: {
      en: [
        '(this is )?my new (phone )?number',
        '(lost|broke|dropped) my phone',
        'my phone (is )?broken',
        'texting (you )?from a (friend\'s|new|different) phone',
      ],
      uk: [
        '(це )?мій новий номер',
        '(загубив~?|розбив~?|втратив~?) телефон',
        'пишу з (чужого|іншого|нового) (телефону|номера)',
      ],
      ru: [
        '(это )?мой новый номер',
        '(потерял~?|разбил~?) телефон',
        'пишу с (чужого|другого|нового) (телефона|номера)',
      ],
      es: [
        '(este es )?mi (nuevo número|número nuevo)',
        'perdí (mi|el) (teléfono|celular)',
        'se me rompió el (teléfono|celular)',
      ],
    },
  },
];
