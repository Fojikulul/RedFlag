<p align="center"><img src="assets/logo.svg" alt="RedFlag" width="320"></p>

RedFlag is a free scam checker. Paste a suspicious text, email or link and it tells you, in plain words, whether it looks like a scam, which parts gave it away, and what to do next. It works in **English, Ukrainian, Russian and Spanish**.

It's built for the people scammers target most: older adults and immigrant families who may not be confident with technology or English. Everything runs in your browser. Nothing you paste is uploaded, stored or shared.

## How it works

RedFlag uses transparent rules, not machine learning. Each rule looks for one tactic scammers rely on:

- **Urgency and threats**: deadlines, locked accounts, threats of arrest or deportation
- **Strange payments**: gift cards, crypto, wire transfers, couriers collecting cash, "small fees"
- **Impersonation**: the IRS, Social Security, banks, delivery companies, tech support, family members
- **Requests for codes and details**: one-time codes, passwords, card numbers
- **Suspicious links**: shorteners, look-alike domains (`paypa1.com`), punycode, raw IP addresses
- **Secrecy, prizes, too-good jobs and investment promises**

Each hit adds to a score. Tactics that scammers stack together, like urgency plus a payment request, add a bonus. The score becomes a verdict: **red** (likely a scam), **yellow** (be careful) or **green** (no common signs found). RedFlag can be wrong, and the page says so.

## Running it

It's a static site with no build step.

```bash
python -m http.server 8080
```

Then open http://localhost:8080. Any static file server works.

## Tests and accuracy

```bash
npm test
npm run evaluate
```

`npm test` runs the unit tests with Node's built-in test runner (Node 20+). `npm run evaluate` scores the rules against the labeled samples in `tests/fixtures/` and lists every miss along with the rules that fired.

The fixtures in the repo are examples modeled on common scams. They are what the rules were tuned on, so the score on them is not a real accuracy number. The numbers on the site come from real messages collected from the community.

## Adding a rule

Rules live in `js/engine/rules/`, one file per category. Each rule has an id, a weight and patterns for all four languages:

```js
{
  id: 'payment.gift_card',
  category: 'payment',
  severity: 'high',
  weight: 35,
  patterns: {
    en: ['gift cards?'],
    uk: ['подарунков~ (карт~|сертифікат~)'],
    ru: ['подарочн~ (карт~|сертификат~)'],
    es: ['tarjetas? de regalo'],
  },
}
```

`~` matches any word ending, which matters a lot for Ukrainian and Russian. ` _ ` allows up to three words in between. Every rule also needs an `explain.<id>` string in each file in `js/i18n/`; the tests fail if one is missing.

## Contributing samples

Real scam messages are the most useful thing anyone can contribute. Add them to a JSON file in this format:

```json
[{ "id": "uk-042", "lang": "uk", "expected": "red", "source": "family", "notes": "", "text": "..." }]
```

**Remove personal details first.** Replace names, phone numbers, emails, addresses and account numbers with placeholders like `[NAME]` and `[PHONE]`.

## AI second opinion (optional)

The rules catch common scams but can miss new wording. When `aiEndpoint` is set in `js/config.js`, every result gets an **Ask the AI** button that sends that one message to a small Cloudflare Worker in `server/`, which asks the Claude API and returns a verdict and a plain explanation in the page's language.

The API key lives only on the Worker as a secret. It is never in the page, the repo or the browser.

```bash
cd server
npm install
cp .dev.vars.example .dev.vars   # then put your key in .dev.vars (git ignores it)
npm run dev                      # Worker on http://localhost:8787
```

Set `aiEndpoint: 'http://localhost:8787'` in `js/config.js` to try it locally. To deploy:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

Then set `aiEndpoint` to the deployed URL and add your site to `ALLOWED_ORIGINS` in `server/wrangler.toml`. The Worker only answers requests from those origins, allows 10 checks a minute per visitor, and never logs message text. Set a monthly spending limit in the Anthropic Console as well. `MODEL` in `wrangler.toml` switches to a cheaper model.

## Partnering with a sheriff's office or police department

Set `localAgency` in `js/config.js` to a name and non-emergency phone number, and the "Where to report it" section shows a button to call them.

## Development

`scripts/grade.js` is an optional developer tool. It sends samples to the Claude API for a second opinion and lists the scams the rules missed, which is where new rules come from. It needs `npm install` and an `ANTHROPIC_API_KEY` in your environment, and it asks before sending anything.

## Privacy

- Messages are checked in the browser. Nothing is sent unless the visitor presses **Ask the AI**, and then only that one message, which the Worker does not store.
- The only things stored are the language and text-size settings, in `localStorage`.
- Fonts and the animation library are served from this site, not from third parties.
- There is a spot in `index.html` for one privacy-friendly page-view counter. Nothing else is tracked.
- Draft [Privacy](privacy.html) and [Terms](terms.html) pages describe this in plain words. Have them reviewed before a formal partnership.

## History

RedFlag was first built in October 2026 (Oct 9–15). The original repository was lost, and the project was rebuilt from scratch and relaunched on October 25, 2026.

## Credits

- [Manrope](https://github.com/sharanda/manrope) font, SIL Open Font License (`assets/fonts/OFL.txt`)
- [Motion](https://motion.dev) for animations, MIT License (`assets/vendor/motion/LICENSE.md`)

## License

MIT © Fojikulul. RedFlag gives general guidance, not legal or financial advice. To report fraud in the US, go to [reportfraud.ftc.gov](https://reportfraud.ftc.gov).
