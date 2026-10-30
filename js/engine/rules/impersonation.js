const DISGUISABLE_WORDS = [
  'job', 'account', 'login', 'password', 'bitcoin', 'crypto', 'paypal', 'amazon', 'bank',
  'verify', 'money', 'free', 'cash', 'winner', 'prize', 'gift', 'payment', 'wallet',
  'refund', 'security', 'support', 'offer', 'bonus', 'apple', 'netflix',
];
const DIGIT_FOR = { o: '0', i: '1', l: '1', e: '3', s: '5', b: '8' };

// "job" becomes a pattern for j0b but not job: at least one letter must be
// a digit look-alike.
function disguised(word) {
  const body = [...word].map((letter) => (DIGIT_FOR[letter] ? `[${letter}${DIGIT_FOR[letter]}]` : letter)).join('');
  return `(?=\\p{L}*\\d)${body}`;
}

// Brand and agency names on their own are weak signals: real companies text
// people too. They mostly matter in combination with a request for codes,
// money or personal details (see the boosts in scoring.js).
export default [
  {
    id: 'impersonation.government',
    category: 'impersonation',
    severity: 'high',
    weight: 25,
    patterns: {
      // An agency's own .gov address is where people should go, so it
      // doesn't count as someone claiming to be the agency.
      en: [
        'irs(?!\\.gov)',
        'internal revenue service',
        'social security (administration|office|department)',
        'ssa(?!\\.gov)',
        'medicare(?!\\.gov)',
        'uscis(?!\\.gov)',
        'immigration (office|services|department|officer)',
        'department of (homeland security|justice|the treasury|treasury)',
        'fbi',
        'dea',
        'federal agent',
        'tax (department|office|authority)',
      ],
      uk: [
        'податков~ (служб~|інспекці~)',
        'пенсійн~ фонд~',
        'сбу',
        'міграційн~ служб~',
        'нбу',
        'національн~ банк~',
        'посольств~',
      ],
      ru: [
        'налогов~ (служб~|инспекци~)',
        'пенсионн~ фонд~',
        'фсб',
        'госуслуг~',
        'центробанк~',
        'центральн~ банк~',
        'миграционн~ служб~',
        'посольств~',
      ],
      es: [
        'servicio de impuestos',
        '(administración|oficina) del seguro social',
        '(servicio|oficina) de inmigración',
        'hacienda',
        'embajada',
      ],
    },
  },
  {
    // "Call us at 1-800..." is how fake alerts get you on the phone with them.
    id: 'impersonation.callback',
    category: 'impersonation',
    severity: 'medium',
    weight: 20,
    patterns: {
      en: [
        'call (us|me|now|our|the|support|immediately) _ (on|at|:) ?\\+?[\\d(]',
        'call (our )?(cancellation|billing|support|security|fraud|refund) (team|department|line|center)',
        'contact _ (team|support|department) ?: ?\\+?[\\d(]',
        'call support (immediately|now|right away)',
      ],
      uk: ['зателефонуй~ (нам )?за номером', 'передзвоні~ (нам )?за номером'],
      ru: ['позвони~ (нам )?по номеру', 'перезвони~ (нам )?по номеру'],
      es: ['llám~ (al|a nuestro) (número|equipo)', 'comuníquese al \\+?\\d'],
    },
  },
  {
    // "j0B", "acc0unt", "pa55word": numbers swapped in to dodge filters.
    // Limited to words scammers disguise, so order numbers like "XK5LM"
    // don't trip it.
    id: 'impersonation.disguised_word',
    category: 'impersonation',
    severity: 'medium',
    weight: 25,
    patterns: {
      en: DISGUISABLE_WORDS.map(disguised),
      uk: [],
      ru: [],
      es: [],
    },
  },
  {
    id: 'impersonation.police',
    category: 'impersonation',
    severity: 'medium',
    weight: 15,
    patterns: {
      en: ['police', 'officer', 'detective', 'sheriff~'],
      uk: ['поліці~', 'кіберполіці~', 'слідч~', 'офіцер~'],
      ru: ['полици~', 'следовател~', 'офицер~'],
      es: ['policía', 'detective', 'agente (federal|de policía)'],
    },
  },
  {
    id: 'impersonation.bank_security',
    category: 'impersonation',
    severity: 'high',
    weight: 25,
    patterns: {
      en: [
        'fraud (department|team|prevention|unit)',
        '(bank|account) security (team|department)',
        'security department of (your|the) bank',
      ],
      uk: ['служб~ безпеки (\\p{L}*банк~|банка)', 'фінансов~ моніторинг~'],
      ru: ['служб~ безопасности (\\p{L}*банк~)?', 'финансов~ мониторинг~'],
      es: ['departamento de (fraudes?|seguridad)', 'área de fraudes?'],
    },
  },
  {
    id: 'impersonation.bank',
    category: 'impersonation',
    severity: 'low',
    weight: 10,
    patterns: {
      en: [
        'chase',
        'wells fargo',
        'bank of america',
        'citibank',
        'capital one',
        'navy federal',
        'td bank',
        'pnc',
        'bofa',
        'us bank',
        'citi',
      ],
      uk: ['приватбанк~', 'монобанк~', 'ощадбанк~', 'райффайзен~'],
      ru: ['сбербанк~', 'сбер', 'тинькофф', 'втб'],
      es: ['bbva', 'santander', 'banorte', 'banamex'],
    },
  },
  {
    id: 'impersonation.delivery',
    category: 'impersonation',
    severity: 'low',
    weight: 10,
    patterns: {
      en: ['usps', 'ups', 'fedex', 'dhl', 'postal service'],
      uk: ['нов~ пошт~', 'укрпошт~', 'meest'],
      ru: ['почт~ россии', 'сдэк', 'boxberry'],
      es: ['correos', 'estafeta', 'servicio postal'],
    },
  },
  {
    id: 'impersonation.delivery_problem',
    category: 'impersonation',
    severity: 'medium',
    weight: 20,
    patterns: {
      en: [
        '(package|parcel|shipment) (is |has been )?(on hold|being held|held|pending|undeliverable|returned)',
        '(could not|couldn\'t|unable to|was unable to) (be )?deliver~',
        'delivery (attempt )?(failed|unsuccessful)',
        'failed delivery',
        'redeliver~',
        'incomplete (address|delivery information|shipping address)',
        '(address|delivery information) (is )?incomplete',
        'issues? (releasing|delivering) your (package|parcel|order)',
        'update (your )?(shipping|delivery) (directions|address|details|information)',
        'trying to find your (house|address|home)',
        'stuck in customs',
        'arrived at the warehouse',
      ],
      uk: [
        '(посилк~|відправлен~) _ (затриман~|не (може бути )?доставлен~|на утриманні)',
        'не вдалося доставити',
        'неповн~ адрес~',
        'повторн~ доставк~',
      ],
      ru: [
        '(посылк~|отправлени~) _ (задержан~|не (может быть )?доставлен~|на удержании)',
        'не удалось доставить',
        'неполн~ адрес~',
        'повторн~ доставк~',
      ],
      es: [
        '(paquete|envío) (está |ha sido )?(retenido|en espera|pendiente|devuelto)',
        'no (se )?pudo (ser )?entregar',
        'entrega fallida',
        'dirección incompleta',
        'reprogramar (la )?entrega',
      ],
    },
  },
  {
    id: 'impersonation.brand',
    category: 'impersonation',
    severity: 'low',
    weight: 10,
    patterns: {
      en: [
        'amazon',
        'apple id',
        'icloud',
        'microsoft',
        'netflix',
        'paypal',
        'facebook',
        'whatsapp',
        'coinbase',
      ],
      uk: ['епл', 'майкрософт'],
      ru: ['эпл', 'майкрософт'],
      es: ['mercado (libre|pago)'],
    },
  },
  {
    id: 'impersonation.tech_support',
    category: 'impersonation',
    severity: 'high',
    weight: 25,
    patterns: {
      en: [
        '(tech|technical) support',
        'your (computer|device|pc|phone|iphone) (is|has been) (infected|hacked|compromised)',
        'virus (detected|found)',
        '(detected|found) (a )?virus',
        'windows defender',
        '(critical|security) (system )?alert',
        '(network|security|data) breach detected',
        'your (computer|device|pc|mac|phone) (has been|is) (locked|blocked|infected|hacked)( up)?',
        'your ip address',
        '(identity theft|trojan|spyware) virus',
        '(contact|call) (microsoft|apple|windows) (support|security)',
      ],
      uk: [
        'ваш~? (комп\'ютер|пристрій|телефон) (заражен~|зламан~)',
        'виявлен~ вірус~',
      ],
      ru: [
        'ваш~? (компьютер|устройство|телефон) (заражен~|взломан~)',
        'обнаружен~ вирус~',
      ],
      es: [
        'soporte técnico',
        '(su|tu) (computadora|dispositivo|teléfono) (está|ha sido) (infectad~|hackead~)',
        'virus detectado',
      ],
    },
  },
  {
    // Remote access hands over the whole device, so it gets its own weight.
    id: 'impersonation.remote_access',
    category: 'impersonation',
    severity: 'high',
    weight: 35,
    patterns: {
      en: ['remote access', 'anydesk', 'teamviewer', 'rustdesk', 'quick ?support'],
      uk: ['віддален~ доступ~'],
      ru: ['удаленн~ доступ~'],
      es: ['acceso remoto'],
    },
  },
];
