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

  // Measured with: node scripts/evaluate-live.js tests/fixtures/sms-test-set.json
  // (rules plus the live AI, on texts RedFlag was not tuned on). Re-run it after
  // changing the rules or the AI, and update these. null shows "Testing in progress".
  stats: {
    messagesTested: 35,
    catchRate: 100,
  },
};
