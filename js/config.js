export default {
  repoUrl: 'https://github.com/Fojikulul/RedFlag',

  // Shown on the workshop button. Leave empty to link to GitHub issues instead.
  contactEmail: '',

  // The Cloudflare Worker from server/ that holds the API keys. When set,
  // every checked message is also sent to it for an AI double-check, and the
  // phone number lookup appears. Leave empty to keep everything on the device.
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
    messagesTested: 372,
    catchRate: 99,
  },
};
