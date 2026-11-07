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

  // Fill these in from the testing spreadsheet once real samples are measured.
  // Anything left null shows "Testing in progress" instead of a number.
  stats: {
    messagesTested: null,
    catchRate: null,
  },
};
