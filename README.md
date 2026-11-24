# Q portfolio

A website for your stock portfolio, made to run on [Cloudflare Workers](https://developers.cloudflare.com/workers/). It opens a brokerage's Quicken export (`.qfx`) and shows which of your shares are **long-term** (held more than a year), with the **cost basis of every purchase**, ranked by how close each stock trades to its all-time high.

Your file is read in your browser and never uploaded.

## Use it

1. In your brokerage account, download your activity as a Quicken file (`.qfx`).
2. Open the site and drop the file on the page, or click **Choose File…**.
3. Your **Performance** page opens, with the **Sell check** one tab over. The result is kept in this browser, so next time you open the site it's still there.

On the report, the toolbar fits on one line on a laptop screen; the icon buttons show their names when you point at them:

| Button | What it does |
|---|---|
| **New file** | Opens a different export; **Back to your last result** returns without changing anything |
| **Refresh prices** (circling arrows) | Gets current prices for the saved result; your purchases stay as they are |
| **Manual / 5, 15, 30 min / 1 hour** (clock) | Updates prices automatically while the US market is open (Mon–Fri, 9:30 AM–4:00 PM New York time), plus once after the close to catch closing prices. Pauses while the tab is hidden and catches up when you return. The page keeps your scroll position. |
| **Hide amounts** (eye) | Hides every dollar amount and share count on both pages, leaving percentages, so you can share a screenshot. Click **Show amounts** to bring them back. **Save report** is off while amounts are hidden, because a saved file always holds your figures |
| **Share card** (Performance page) | A ready-to-post image of your returns, percentages only. **All time**: total return against the index, best performers, this year, the last 12 months, per year, and the largest drop with how far you've come back since. **This year**: the return since January 1, the best performers this year, the last month, 3 months and 12 months, and this year's largest drop. **Save image** or **Copy image**; it's made in your browser |
| **Save report** (download arrow) | Downloads the report as one HTML file that opens in any browser, even offline |
| **Forget this result** (trash can) | Removes the saved result from this browser, along with the sectors you chose and anything else that names your stocks (click twice to confirm) |
| **EN / RU** (next to Theme, on every page) | Shows the site in English or Russian, numbers and dates included. Kept in this browser; without a choice, your browser's language decides. A saved report opens in the language it was saved in and has its own switch |
| **Theme** (top right of both pages) | System, Light, Dark, GitHub Light/Dark, One Dark, Dracula, Tokyo Night, Catppuccin Latte/Mocha, Nord, Solarized Light/Dark. Each option shows its colors, and moving through the list (mouse or arrow keys) previews it on the page; Esc undoes the preview. |

## Performance page

The **Performance** tab shows how your stocks have done, compared with the market:

- **Your gains** today (the last trading day), last week, this year, and over the last *N* years (type a number). Gains don't count money you added; each shows your time-weighted return next to the index's.
- **What you own:** a treemap of your stocks, each tile sized by its share of your portfolio and grouped by sector (funds together). Switch **Color** to **Gain** to shade tiles from red to green by how far each is above or below what you paid. Hover a tile for its industry, value, gain and long-term shares. **Click a tile to change its sector** (for example, to count a stock as Technology); your choices are kept in this browser. Holdings under 1.5% are drawn at 1.5% so they stay visible, with their real share on the label.
- **Totals:** value now, total gain (including dividends), how far ahead of or behind the market you are, your yearly (money-weighted) return, and the largest drop from a previous high, with how far you've come back since the low and whether you're above that high again.
- **Your stocks against the market:** weekly value of your stocks, the same money put into an index on the same days, and what you put in, with **every week's buys and sales as bars on the same timeline** (hover for the stocks). Switch to **Return (%)** for time-weighted growth, which ignores when you added money and is the fair comparison with an index. Periods: 6M, YTD, 1Y, 2Y, All.
- **Compare with** the S&P 500 (SPY), Nasdaq 100 (QQQ) or total US market (VTI), with dividends reinvested.
- **How each stock did:** value, weight, gain on shares held, gain on sales, dividends, total gain, return, and gain compared with putting the same money into the index. Sortable; can include stocks you've sold.
- **Buying and selling:** money in and out by month, and every buy, sale and dividend, filterable by stock and type.

Results saved before this page existed don't have your history yet: upload the same export again.

## Sell check

The **Sell check** tab shows which shares you can sell at the lower long-term rate:

- **Your tax rates:** pick your income tax bracket and long-term rate, add a state rate, and tick the 3.8% net investment income tax if it applies. They're kept in this browser and used for every tax estimate on the page. These are rough estimates: deductions, limits and your other gains and losses for the year aren't counted.
- **Best to sell now:** long-term shares at a gain trading within 20% of their all-time high, with how much you can sell as long-term, the profit in it and the estimated tax. Click one for details.
- **Totals:** how much you can sell as long-term, the profit in it and its estimated tax, your short-term shares, and what turns long-term in the next 30 days with the tax saved by waiting.
- **All your purchases**, oldest first, with **Group by stock** for a subtotal line per stock that opens to show its purchases, and a chart of every buy (above the line) and sale (below) by date and amount, on a log scale so small and large trades both show. Pick a stock to see its purchases against its price, with its sales marked, and to open **Estimate the tax on a sale**.
- **Turning long-term in the next 90 days**, with the **tax saved by waiting** (today's profit times the gap between your income rate and long-term rate).
- **Losses you could use:** shares worth less than you paid, the short- and long-term loss in them, the most tax they could offset at your rates, and a **wash sale check**: if you bought the same stock in the last 30 days and would still hold those shares, it says how much of the loss would be blocked and the first day it's clear.
- **Your sales by tax year:** short- and long-term gains from the sales in your export, the estimated tax at your rates, and how much this year's tax would drop if you took today's losses.
- The tax calculator warns when a sale would be a wash sale, and reminds you not to buy the stock back within 30 days of selling at a loss.
- The stock you're looking at and the amount you typed stay put when prices update.
- Works on phones: less important columns hide on narrow screens.

## Selling by dollar amount

Some brokers ask for a dollar amount and choose the shares themselves. Some sell losing shares first, then the shares with the smallest tax (usually long-term gains); others sell the oldest first, the IRS default. Your long-term shares are always your oldest, so the **Sell up to** amount for each stock creates no short-term profit under either rule. Each stock's **Estimate the tax on a sale** calculator shows the long-term and short-term profit for any amount, under both rules, with the estimated tax for each.

## Privacy

What leaves your browser, and where it goes:

| | Where it goes |
|---|---|
| Your Quicken file and everything in it | **Nowhere.** It's read by the page in your browser. |
| Ticker symbols (for example `AAPL`), including stocks you've sold and the index you compare with (`SPY`, `QQQ` or `VTI`) | This site's `/api/chart` (prices) and `/api/profile` (sector and industry, looked up once per stock and kept in your browser), which ask Yahoo Finance. Each request holds one ticker and nothing else. |
| Ticker symbols, for company logos | This site's `/api/logo`, which asks Parqet's logo service and, when it has none, Financial Modeling Prep's. They see only the ticker, coming from Cloudflare, never your IP address. Only PNG, JPEG or WebP images up to 300 KB are passed on. |
| Anything else | Nothing. The pages load only this site's own files: no analytics, fonts, ads or other websites. |

What's kept, and where:

- **In your browser only:** the last result (your purchases, sales, dividends and the prices used) and your choices of theme, tax rates, hidden amounts, comparison index, period and any sectors you've changed, in the browser's local storage for this site. **Forget this result** removes the result and every setting that names a stock; clearing the site's data in your browser removes everything.
- **Save report** downloads only the sell check: your open purchases, your buys and sales (date, stock, shares, price, amount), each sale's gain, and current prices; not dividends or price history.
- **On Cloudflare:** nothing about you. Request logs and traces are turned off (`observability` in `wrangler.jsonc`), so no list of tickers or IP addresses is kept in the account. Price answers are cached for 5 minutes by ticker symbol only, so they say nothing about who asked.
- **What Cloudflare inevitably sees** while serving a request: your IP address and the ticker symbols you look up, as any web host would. Yahoo sees only the ticker symbols, coming from Cloudflare, never your IP address. If Yahoo's main price server (`query1.finance.yahoo.com`) fails, the Worker asks its second one (`query2`) with the same request.

**Cloudflare usage.** The free plan allows 100,000 requests a day. An automatic update is one price lookup per stock you hold plus one per comparison index, and the page reloads. Scripts, styles and logos are kept by your browser, so the reload is one request: roughly 18 requests for a 16-stock portfolio. Every 5 minutes through a full trading day (78 updates) that's about 1,400 requests for one open tab: around 1.4% of the free allowance. Nothing runs while the market is closed or the tab is hidden.

Wrangler's own usage statistics are turned off in `npm run dev` and `npm run deploy`.

## Security

- **Strict Content Security Policy:** pages can run only this site's own scripts and talk only to this site. Also `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `nosniff`, HSTS and a locked-down `Permissions-Policy`, all set by the Worker on every response (`src/worker.mjs`).
- **The lookups accept very little** (`src/chart.mjs`): GET only, a ticker matching `[A-Z][A-Z0-9.-]{0,9}`, and one of a few fixed history ranges. Anything else, including extra parameters, is rejected. The lookups answer only requests a browser has labeled as coming from this site's own pages: other websites, scripts and command-line tools are refused.
- **No secrets, no database, no accounts.** There's nothing to steal on the server.

### Make the site private (recommended)

A `workers.dev` address is public: anyone who finds it can open the page (they'd see no data of yours, since there is none on the server). With Access on, Cloudflare's own cache isn't available to the Worker, so every price lookup goes to Yahoo. To let only you in, put **Cloudflare Access** in front of it. It's free for up to 50 people:

1. In the Cloudflare dashboard, open **Zero Trust** (the first time, pick the **Free** plan and a team name).
2. Go to **Access › Applications › Add an application › Self-hosted**.
3. Application domain: your site's address, for example `q-portfolio.<your-subdomain>.workers.dev`.
4. Add a policy: **Action** Allow, **Include** Emails, and enter your email.
5. Save. Visitors now need a one-time code sent to that email before the site opens.

## Run it

You need Node.js 20 or later.

```bash
npm install
```
```bash
npm test
```

Run it on your computer at `http://127.0.0.1:8787`:

```bash
npm run dev
```

Put it online on your Cloudflare account (the first time, `npx wrangler login` opens a browser for you to sign in):

```bash
npx wrangler login
```
```bash
npm run deploy
```

Wrangler prints the site's address, ending in `.workers.dev`. Each `npm run deploy` publishes the current code.

## How the numbers are worked out

- Every buy, sell, transfer and split in the export is replayed in date order to rebuild the open purchases ("tax lots"). Earlier sales are assumed to have taken the oldest shares first, the IRS default. Splits rescale shares and cost per share; a reverse split that changes a stock's CUSIP is merged under its ticker.
- The rebuilt share counts are checked against the positions in the export. Any stock that doesn't match is listed in the report's notes.
- A purchase is long-term when sold **after** the one-year anniversary of the purchase date.
- **Wash sales:** when a sale at a loss has the same stock bought within 30 days before or after it, the loss can't be claimed then. The disallowed part is added to the replacement shares' cost, and their holding period starts at the original purchase's date. Replacements are matched oldest first, each share used once, and a purchase only partly used as a replacement is split. Those purchases are marked **Wash sale** on the sell check.
- **Tax estimates** tax long-term gains at your long-term rate and short-term gains at your income bracket, plus your state rate and the 3.8% tax if ticked. A loss of one kind offsets a gain of the other.
- **One stock can't stop the rest.** If a price can't be found (a delisted stock, or one the export gives no ticker for), that stock is valued at what you last paid and marked **No price**; everything else is worked out as usual. Lookups run four at a time.
- **Dates are New York's.** Price times and "today" use the exchange's time zone wherever you are, so a share doesn't turn long-term a day early when you're abroad.
- **Price history** is weekly, for 5 years, 10 years or everything, whichever your first purchase needs.
- **Market hours** follow the New York Stock Exchange calendar, worked out from its rules (New Year's, MLK Day, Presidents' Day, Good Friday, Memorial Day, Juneteenth, Independence Day, Labor Day, Thanksgiving, Christmas, and the 1:00 PM early closes), so automatic updates skip holidays without a calendar to maintain.
- The all-time high is the highest intraday price Yahoo Finance reports, adjusted for splits.
- Verdicts use simple cutoffs: within 10% of the all-time high is a *sell candidate*, and 10–20% below is *near high*.

This is a holding-period and tax estimate, not tax or investment advice.

## Project layout

```
src/worker.mjs              serves the site, adds security headers, answers /api/chart, /api/profile and /api/logo
src/chart.mjs               checks price and sector requests
wrangler.jsonc              Cloudflare settings (logs off, every request through the Worker)
public/index.html, app.css  start page: drop zone and theme picker
public/shared.js            helpers every page uses: dates, sale order, tax estimate, number formats, charts
public/base.css             styles both result pages share
public/start.js             reads the file in the browser and builds the result
public/report-template.html the report; also what Save report downloads
public/report-boot.js       shows the saved result on the sell check
public/performance.html     the performance page; perf.js draws it, perf.css styles it
public/perf-calc.js         performance math: weekly value, same money in the index, returns
public/toolbar.js           the results toolbar: Refresh prices, automatic updates, Hide amounts, Save report, Forget
public/share.js             the share card: returns as an image, percentages only
public/market.js            whether the US market is open (New York time, with holidays), and when an update is due
public/web.js               theme picker and browser storage
public/picker.css           theme picker styles
public/web.css              report toolbar styles
public/lots.js              QFX parsing, tax-lot rebuild and wash sales
public/prices.js            asks /api/chart for prices
scripts/themes.mjs          color themes
scripts/sync.mjs            generates themes.css, theme-list.js, report.html, report.js and both pages' toolbar
test/                       tests, using made-up exports in test/fixtures
```

`public/themes.css`, `theme-list.js`, `report.html` and `report.js` are generated before every run and deploy, so edit `scripts/themes.mjs` and `public/report-template.html` instead. The template keeps its own copies of the themes, `base.css` and `shared.js` (so a saved report works offline); the build refreshes them. Pages name their files with `?v=<fingerprint>`, so after a deploy a browser never mixes old and new files. Real exports (`*.qfx`, `*.ofx`) and downloaded reports are ignored by git.

## License

MIT. See `LICENSE`.

## Credits

The app icon uses the "calendar-dollar" icon from [Tabler Icons](https://tabler.io/icons) by Paweł Kuna, under the MIT License (see `LICENSE-tabler-icons`).
