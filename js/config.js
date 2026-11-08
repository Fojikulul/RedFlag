export default {
  repoUrl: 'https://github.com/Fojikulul/RedFlag',

  // Shown on the workshop button. Leave empty to link to GitHub issues instead.
  contactEmail: '',

  // The AI check from server/. Every message is checked by the rules on the
  // device and by the AI here, and the AI leads the verdict. '/api/check'
  // works when the site is served by that Worker; use the Worker's full URL
  // when the site is hosted somewhere else. Leave empty for rules only.
  aiEndpoint: '/api/check',

  // A partnering sheriff's office or police department. When both are set,
  // the "Where to report it" section shows a button to call them.
  localAgency: {
    name: '',
    phone: '',
  },

  // 35 from tests/fixtures/sms-test-set.json, measured with
  // `npm run evaluate:live` (25/25 scams caught, 0/10 false alarms), plus 124
  // scam texts in tests/fixtures/hand-checked.json that the owner checked by
  // hand on the live site; their verdicts were not recorded here. Keep the
  // "stats.tested.text" copy in sync. null shows "Testing in progress".
  stats: {
    messagesTested: 159,
    catchRate: 99,
  },
};
