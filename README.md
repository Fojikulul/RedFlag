<p align="center"><img src="assets/logo.svg" alt="RedFlag" width="320"></p>

RedFlag is a free scam checker. Paste a suspicious text, email or link and it tells you, in plain words, whether it looks like a scam, which parts gave it away, and what to do next. It works in **English, Ukrainian, Russian and Spanish**.

It's built for the people scammers target most: older adults and immigrant families who may not be confident with technology or English. Every message is checked twice, by rules in your browser and by an AI on a small server, and nothing you paste is stored or shared.

## How it works

Two checks run on every message at the same time.

**Rules, in the browser.** Each rule looks for one tactic scammers rely on:

- **Urgency and threats**: deadlines, locked accounts, threats of arrest or deportation
- **Strange payments**: gift cards, crypto, wire transfers, couriers collecting cash, "small fees"
- **Impersonation**: the IRS, Social Security, banks, delivery companies, tech support, family members
- **Requests for codes and details**: one-time codes, passwords, card numbers
- **Suspicious links**: shorteners, look-alike domains (`paypa1.com`), punycode, raw IP addresses
- **Secrecy, prizes, too-good jobs and investment promises**

Each hit adds to a score. Tactics that scammers stack together, like urgency plus a payment request, add a bonus. The score becomes a verdict: **red** (likely a scam), **yellow** (be careful) or **green** (no common signs found).

**An AI, on the server.** The message also goes to `/api/check`, a Cloudflare Worker that asks an AI model for a verdict, a 0-100 score, a plain explanation and one next step, in the page's language.

The AI leads: its verdict and explanation are what the visitor sees first, and both scores are shown. The rules keep it honest. A scam can tell the AI it is harmless, but it can't talk the rules out of what they see, so when the rules say red the answer is never green (`js/combine.js`). If the AI can't be reached, the rules answer alone and the page says so. RedFlag can be wrong, and the page says that too.

## Running it

The site itself is static, with no build step:

```bash
python -m http.server 8080
```

Then open http://localhost:8080. Any static file server works. Without the Worker, the AI check is unavailable and the rules answer alone.

To run the whole thing, site and AI, the way it runs online:

```bash
cd server
npm install
npx wrangler login
npm run dev
```

Then open http://localhost:8787. Workers AI always runs on Cloudflare, even in development, so it needs the login.

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

## Hosting on Cloudflare (site and AI)

One Cloudflare Worker in `server/` serves the whole site and the AI check. `server/wrangler.toml` publishes the repository root as the site, minus what `.assetsignore` lists (the server code, tests, scripts and marketing files).

```bash
cd server
npm install
npx wrangler login
npm run deploy
```

The site is then live at `https://redflag.<your-account>.workers.dev`. A custom domain can be added in the Cloudflare dashboard.

**Cost.** By default the AI is Cloudflare Workers AI (`AI_PROVIDER = "workers-ai"`), with `@cf/google/gemma-4-26b-a4b-it`. On the Workers Free plan it includes 10,000 Neurons a day, roughly 1,000 checks depending on message length (a short message used about 8 Neurons in testing), and when they run out it stops until midnight UTC instead of billing. RedFlag then answers with its rules alone. Stay on the Free plan and it can't cost anything. (On Workers Paid, extra use is billed, so set a budget alert there.) Each visitor can run 10 checks a minute.

`MODEL` in `wrangler.toml` picks another Workers AI model. Pick one that is available on the Free plan and handles all four languages.

**Claude instead.** Set `AI_PROVIDER = "claude"` and add the key with `npx wrangler secret put ANTHROPIC_API_KEY`. It is paid per check (`claude-haiku-5-5` by default), so set a monthly spending limit in the Anthropic Console.

**Hosting the site elsewhere** (GitHub Pages, for example): set `aiEndpoint` in `js/config.js` to the Worker's full URL ending in `/api/check`, and add the site's address to `ALLOWED_ORIGINS` in `wrangler.toml`. The site's own pages are always allowed.

API keys live only on the Worker. They are never in the page, the repo or the browser, and the Worker never logs message text.

## Partnering with a sheriff's office or police department

Set `localAgency` in `js/config.js` to a name and non-emergency phone number, and the "Where to report it" section shows a button to call them.

## Development

`scripts/grade.js` is an optional developer tool. It sends samples to the Claude API for a second opinion and lists the scams the rules missed, which is where new rules come from. It needs `npm install` and an `ANTHROPIC_API_KEY` in your environment, and it asks before sending anything.

## Privacy

- Each message is checked by the rules in the browser and sent once to the Worker for the AI check. The Worker doesn't store or log it, and Cloudflare says Workers AI doesn't train on it.
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
