// The Worker in server/ serves the site and its /api/ routes. A copy of the
// site hosted somewhere else (Vercel, GitHub Pages) calls that Worker by its
// full address instead.
const WORKER = 'https://redflag.redflag-ai.workers.dev';
const host = globalThis.location?.hostname ?? '';
const servedByWorker = host.endsWith('.workers.dev') || globalThis.location?.port === '8787';
const api = servedByWorker ? '/api' : `${WORKER}/api`;

export default {
  repoUrl: 'https://github.com/Fojikulul/RedFlag',

  // Shown on the workshop button. Leave empty to link to GitHub issues instead.
  contactEmail: 'dovzhenokvasya@gmail.com',

  // The AI check from server/. Every message is checked by the rules on the
  // device and by the AI here, and the AI leads the verdict. Leave empty for
  // rules only.
  aiEndpoint: `${api}/check`,

  // Phone number lookup from the same Worker. A number is sent only when the
  // visitor presses "Look it up". Empty hides the lookup.
  lookupEndpoint: `${api}/lookup`,

  // Live count of checks from the Worker (GET /api/stats). The card stays
  // hidden until at least usageMinToShow checks have been made, so a brand
  // new site doesn't advertise "3 messages checked". Empty to turn it off.
  usageEndpoint: `${api}/stats`,
  usageMinToShow: 1,

  // A partnering sheriff's office or police department. When both are set,
  // the "Where to report it" section shows a button to call them.
  localAgency: {
    name: '',
    phone: '',
  },

  // Measured by the owner on the live site: 372 scam and everyday messages
  // checked by hand, 99% of the scams marked red or yellow. null shows
  // "Testing in progress".
  stats: {
    messagesTested: 372,
    catchRate: 99,
  },
};
