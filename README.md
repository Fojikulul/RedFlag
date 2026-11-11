<p align="center"><img src="assets/logo.svg" alt="RedFlag" width="320"></p>

RedFlag is a free scam checker. Paste a suspicious text, email or link and it tells you, in plain words, whether it looks like a scam, which parts gave it away, and what to do next. It works in **English, Ukrainian, Russian and Spanish**.

It's built for the people scammers target most: older adults and immigrant families who may not be confident with technology or English. The rules run in your browser. On its own, the site uploads nothing. If you turn on the optional AI Worker, messages are also double-checked by an AI and visitors can look up phone numbers; the page tells them plainly what gets sent and where.

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

## AI double-check and phone lookup (optional)

Both need the small Cloudflare Worker in `server/`. They switch on when `aiEndpoint` is set in `js/config.js`, and the page's privacy wording changes with them. Leave `aiEndpoint` empty and the site stays rules-only: nothing leaves the device.

### AI double-check

The rules catch common scams but can miss new wording. With the Worker on, every message that is checked is also sent to Google's Gemini API, and the two answers are combined (`js/engine/combine.js`):

- If they agree, the verdict stands.
- If the AI is **more** worried, the AI's verdict is used.
- If the AI is **less** worried, the warning drops **one step only** (red to yellow, yellow to green), and everything the rules found stays on screen. The AI alone can never turn a red into green.
- If the AI can't answer, the rules verdict is shown and the page says so.

### Phone number lookup

A visitor types a number that called or texted them. The Worker answers from two places:

1. **FTC reports.** The FTC publishes the Do Not Call complaints people file, but its API can't be searched by phone number. So the Worker copies the reports into a Cloudflare D1 database on a schedule, and lookups read that copy. The numbers people look up are never sent to the FTC.
2. **A web search.** Gemini searches Google for the number and sums up what it finds, with links to the pages it read.

The answer is **red** (reported as a scam), **yellow** (some reports) or **grey** (no reports found). There is no green: finding nothing doesn't make a number safe, and the page says that.

### Counting use

The Worker keeps one number per day for message checks and one for phone lookups, in the `daily_counts` table. Nothing else about a check is stored: no text, no phone number, no result, no address. A second try at the same message isn't counted twice. Days are in UTC.

The total appears on the site as **Messages checked**. For the day-by-day numbers:

```bash
cd server
npm run counts
```

`GET /stats` on the Worker returns the totals and the last 30 days as JSON. Checks are only counted while `aiEndpoint` is set, because without the Worker a check never leaves the device and there is nothing to count it.

### Keys

All keys live on the Worker as secrets. None is in the page, the repo or the browser.

| Secret | Where to get it | Used for |
| --- | --- | --- |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) | Message double-check and web search |
| `FTC_API_KEY` | [api.data.gov/signup](https://api.data.gov/signup/) (free) | Importing FTC reports |

Two things to know about the Gemini key:

- **Web search needs billing turned on.** Google doesn't offer search on the free tier. Without it the message double-check still works and phone lookups use FTC reports only; the page says the web search wasn't available.
- **On the free tier, Google may use what is sent to improve its products.** On the paid tier it doesn't. The page and `privacy.html` are worded for the free tier. If you turn billing on, soften that wording.

### Running it locally

```bash
cd server
npm install
cp .dev.vars.example .dev.vars   # then put your keys in .dev.vars (git ignores it)
npm run db:init                  # creates the local report tables
npm run dev                      # Worker on http://localhost:8787
```

Set `aiEndpoint: 'http://localhost:8787'` in `js/config.js` and serve the site on port 8080. To pull some FTC reports into the local database, run the import by hand while the Worker is running:

```bash
curl "http://localhost:8787/__scheduled?cron=*/20+*+*+*+*"
```

### Deploying

```bash
npx wrangler d1 create redflag-reports   # paste the id it prints into wrangler.toml
npm run db:init:remote
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put FTC_API_KEY
npm run deploy
```

Then set `aiEndpoint` to the deployed URL and add your site to `ALLOWED_ORIGINS` in `server/wrangler.toml`. The import runs every 20 minutes and fills in the last two weeks first, so the database takes a few days to catch up; reports older than a year are dropped.

The Worker only answers requests from the allowed origins, allows 10 message checks and 3 phone lookups a minute per visitor, and never logs or stores message text or phone numbers; it keeps only a daily count. Set a spending limit in Google AI Studio as well.

To use the Claude API for the message double-check instead, set `AI_PROVIDER = "claude"` in `wrangler.toml` and add an `ANTHROPIC_API_KEY` secret. Phone lookups always use Gemini, because it can search the web. The wording on the page names Google, so change the `ai.text`, `tool.privacyAi` and `faq.1.aAi` strings and `privacy.html` if you switch.

## Partnering with a sheriff's office or police department

Set `localAgency` in `js/config.js` to a name and non-emergency phone number, and the "Where to report it" section shows a button to call them.

## Development

`scripts/grade.js` is an optional developer tool. It sends samples to the Claude API for a second opinion and lists the scams the rules missed, which is where new rules come from. It needs `npm install` and an `ANTHROPIC_API_KEY` in your environment, and it asks before sending anything.

## Privacy

- With `aiEndpoint` empty, messages are checked in the browser and nothing is sent anywhere.
- With the Worker on, each checked message also goes through the Worker to Google's Gemini API, and the line under the Check button says so. A phone number is sent only when the visitor presses **Look it up**.
- The Worker never logs or stores messages or phone numbers. Its database holds a copy of public FTC reports and a daily count of checks and lookups, nothing else.
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
