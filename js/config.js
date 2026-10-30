export default {
  repoUrl: 'https://github.com/Fojikulul/RedFlag',

  // Shown on the workshop button. Leave empty to link to GitHub issues instead.
  contactEmail: '',

  // The Cloudflare Worker from server/ that holds the API key. Leave empty to
  // hide the "Ask the AI" option entirely.
  aiEndpoint: '',

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
