export default [
  {
    id: 'payment.gift_card',
    category: 'payment',
    severity: 'high',
    weight: 35,
    patterns: {
      en: [
        'gift cards?',
        '(google play|itunes|apple|steam|target|walmart|ebay|razer gold|vanilla) (gift )?cards?',
        'scratch (off )?the back',
        'codes? (on|from) the back',
      ],
      uk: [
        'подарунков~ (карт~|сертифікат~)',
        'карт~ (google play|itunes|apple|steam)',
      ],
      ru: [
        'подарочн~ (карт~|сертификат~)',
        'карт~ (google play|itunes|apple|steam)',
      ],
      es: [
        'tarjetas? de regalo',
        'tarjetas? (de )?(google play|itunes|apple|steam)',
      ],
    },
  },
  {
    id: 'payment.crypto',
    category: 'payment',
    severity: 'high',
    weight: 30,
    patterns: {
      en: [
        'bitcoin(s)?',
        'btc',
        'crypto(currency|currencies)?',
        'usdt',
        'tether',
        'ethereum',
        '(crypto|bitcoin) (atm|wallet)',
        'wallet address',
      ],
      uk: ['біткоїн~', 'біткоін~', 'криптовалют~', 'крипто~ гаман~'],
      ru: ['биткоин~', 'биткойн~', 'криптовалют~', 'крипто~ кошел~'],
      es: ['criptomoneda~', 'billetera (digital|cripto|de bitcoin)'],
    },
  },
  {
    id: 'payment.wire',
    category: 'payment',
    severity: 'high',
    weight: 30,
    patterns: {
      en: [
        'wire (transfer|the money|money|funds|it)',
        'western union',
        'moneygram',
        'money ?order',
        'cash in (an|a) envelope',
        'courier (will|to) (pick it up|pick up|collect|come)',
      ],
      uk: [
        'western union',
        'грошов~ переказ~',
        'надішл~ гроші',
        'кур\'?єр (забере|приїде|прийде)',
        'переда~ (гроші )?кур\'?єру',
      ],
      ru: [
        'денежн~ перевод~',
        'перевед~ деньги',
        'отправ~ деньги',
        'курьер (заберет|приедет|придет)',
        'переда~ (деньги )?курьеру',
      ],
      es: [
        'transferencia (bancaria|de dinero)',
        'giro (postal|de dinero)',
        'envi(e|a|ar) (el )?dinero',
        'un mensajero (pasará|recogerá|irá)',
      ],
    },
  },
  {
    id: 'payment.p2p',
    category: 'payment',
    severity: 'medium',
    weight: 15,
    patterns: {
      en: ['zelle', 'venmo', 'cash ?app', 'paypal friends and family'],
      uk: ['(скин~|перекин~|переказ~|надішл~) (мені )?на (картку|карту)'],
      ru: ['(скин~|перекин~|перевед~|отправ~) (мне )?на карт~'],
      es: ['(envíame|mándame|deposítame|transfiéreme) (a|en) (mi|esta) (cuenta|tarjeta)'],
    },
  },
  {
    id: 'payment.fee_to_receive',
    category: 'payment',
    severity: 'high',
    weight: 25,
    patterns: {
      en: [
        '(pay|send) (a )?(small |one-time )?(fee|deposit|tax|charge) (to|before|in order to) (receive|claim|release|unlock|get)',
        '(processing|release|redelivery|customs|clearance|unlock) fee',
        '(small|unpaid|outstanding) (fee|toll|shipping fee)',
        'unpaid toll',
      ],
      uk: [
        'сплат~ (комісі~|збір|мито)',
        'комісі~ за (отримання|доставку|переказ|розблокування)',
        'митн~ (збір|платіж)',
      ],
      ru: [
        'оплат~ (комисси~|сбор|пошлин~)',
        'комисси~ за (получение|доставку|перевод|разблокировку)',
        'таможенн~ (сбор|пошлин~|платеж~)',
      ],
      es: [
        'pag(ar|ue|a) (una )?(pequeña )?(tarifa|comisión|cuota) (para|antes de) (recibir|reclamar|liberar)',
        'tarifa de (reenvío|procesamiento|liberación|aduana)',
        'peaje (pendiente|impago|no pagado)',
      ],
    },
  },
  {
    id: 'payment.demand',
    category: 'payment',
    severity: 'medium',
    weight: 15,
    patterns: {
      en: [
        'pay (now|today|immediately|the fine|the balance|the amount|the penalty|\\$ ?\\d[\\d,.]*)',
        'payment (is )?(required|overdue|due immediately|must be made)',
        'outstanding (balance|debt|amount)',
        'you owe',
      ],
      uk: [
        'сплат~ (зараз|негайно|сьогодні|штраф|борг|заборгованість|\\$ ?\\d[\\d,.]*|\\d[\\d,.]* ?(грн|гривень|\\$|доларів))',
        'заборгован~',
        'ви винні',
      ],
      ru: [
        'оплат~ (сейчас|немедленно|сегодня|штраф|долг|задолженност~|\\$ ?\\d[\\d,.]*|\\d[\\d,.]* ?(руб~|\\$|долларов))',
        'задолженност~',
        'вы должны (заплатить|оплатить)',
      ],
      es: [
        'pag(ue|ar|a) (ahora|hoy|inmediatamente|la multa|el saldo|la deuda|\\$ ?\\d[\\d,.]*)',
        'saldo (pendiente|vencido)',
        'deuda pendiente',
        'usted debe',
      ],
    },
  },
];
