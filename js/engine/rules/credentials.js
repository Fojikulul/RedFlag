// Real services warn "never share this code", which reads almost exactly like
// a scammer asking for it. skipIfNegated drops matches right after a negation.
export default [
  {
    id: 'credentials.code_request',
    category: 'credentials',
    severity: 'high',
    weight: 30,
    skipIfNegated: true,
    patterns: {
      en: [
        '(send|share|tell|give|read|forward|text) (me |us )?(back )?(the |your |that |this )?(\\d-digit |six-digit )?(verification |security |confirmation |one-time |login |sms |whatsapp |card )?(codes?|pin)',
        'reply with (the |your )?(\\d-digit )?code',
        'what (is|was) the code',
      ],
      uk: [
        '(надішл~|продиктуй~|скажі?ть|повідом~|назві?ть|перешл~) (мені |нам )?(код~|смс|пароль|cvv|пін)',
        'код~ (з|із) (смс|повідомлення)',
      ],
      ru: [
        '(отправ~|продиктуй~|скажи~|сообщи~|назови~|перешли~) (мне |нам )?(код~|смс|пароль|cvv|пин)',
        'код~ из (смс|сообщения)',
      ],
      es: [
        '(envíe|envíame|envíenos|comparta|dígame|dime|reenvíe|reenvíame|proporcione) (el |su |ese |este )?código',
        'código (de verificación |de seguridad )?que (le|te) (enviamos|llegó)',
      ],
    },
  },
  {
    id: 'credentials.personal_info',
    category: 'credentials',
    severity: 'high',
    weight: 25,
    skipIfNegated: true,
    patterns: {
      en: [
        '(verify|confirm|update|provide|enter|send|reply with|validate|re-enter) (your |the )?(ssn|social security number|account (number|details|information)|card (number|details|information)|bank (details|information|account)|password|pin|cvv|login (details|credentials|information)|personal (details|information)|billing (details|information|address)|payment (details|information|method)|date of birth)',
        '(verify|confirm|validate) (your )?(identity|account)',
        'log ?in (here|now|to (verify|confirm|restore|unlock|avoid))',
        'click (here|the link|below|this link) to (verify|confirm|update|restore|unlock|claim|log ?in|sign in|reactivate)',
        'update your (payment|billing|account|delivery|shipping) (method|information|details|address)',
      ],
      uk: [
        '(підтверді~|онові~|вкажі~|введі~|надішл~|повідом~) (свої |ваші )?(дані|паспортн~ дан~|номер картки|дані картки|пароль|пін-код|cvv|реквізит~|особист~ дан~|платіжн~ дан~)',
        'підтверді~ (свою )?особу',
        'перейді~ за посиланням _ (підтверд~|отрима~|розблок~|онов~)',
        'увійді~ (за посиланням|тут)',
      ],
      ru: [
        '(подтверди~|обнови~|укажи~|введи~|отправ~|сообщи~) (свои |ваши )?(данные|паспортн~ данн~|номер карты|данные карты|пароль|пин-код|cvv|реквизит~|личн~ данн~|платежн~ данн~)',
        'подтверди~ (свою )?личност~',
        'перейди~ по ссылке _ (подтверд~|получ~|разблок~|обнов~)',
        'войди~ (по ссылке|здесь)',
      ],
      es: [
        '(verifique|confirme|actualice|proporcione|ingrese|envíe|verifica|confirma|actualiza) (sus |su |los |tus |tu )?(datos|número de (tarjeta|cuenta)|contraseña|pin|cvv|información (personal|bancaria|de pago)|fecha de nacimiento)',
        '(confirme|verifique|confirma|verifica) (su |tu )?identidad',
        'haga clic (aquí|en el enlace) para (verificar|confirmar|actualizar|reclamar|desbloquear)',
        'ingrese (aquí|al enlace)',
      ],
    },
  },
];
