# FIREdrill

A FIRE (Financial Independence, Retire Early) calculator for Indian households. Enter what your household spends, owns and invests, and it works out your FIRE number, whether you are on track, and how long your money lasts if you stop working.

Everything runs in your browser, with no backend, account or build step.

## What it tells you

- FIRE number at your chosen retirement age, in future rupees and in today's money.
- On track or not: projected corpus at retirement against the FIRE number, the surplus or shortfall, and the extra monthly SIP needed to close a gap.
- If you retire tomorrow: how many years your current investments would last, the first-year withdrawal and the withdrawal rate.
- Corpus over time: a chart of both scenarios (retire as planned, retire tomorrow).
- In the guided view, a monthly cash-flow table for planned retirement or retiring today, showing withdrawals, interest, goal payments, and the remaining balance. It stops when the balance runs out.
- Spending cuts: how much longer the FIRE number lasts if you spend 2% to 10% less after retiring.
- CSV export and import of your complete input plan, so you can return to it later.

## What you enter

| Section | Notes |
| --- | --- |
| Household | Your age, retirement age, plan-until age. Optionally a spouse with their own age and retirement age. |
| Monthly and yearly expenses | Each row has the share that continues after retiring (0% if it ends, above 100% if it grows) and an inflation type: general, healthcare or education. |
| Loan EMIs | Stop when the loan ends and are not inflated. |
| Existing investments | Equity, EPF, PPF, NPS, FDs, gold and so on, each with its own expected return. Separate columns for you and your spouse. |
| Monthly SIPs | Continue until each person retires and step up yearly. |
| Income after retiring | Rent, pension and similar, from a given age until a stop age. The monthly amount is in today's money and rises each year with general inflation. For rent, set the stop age to the age when you sell; no rent is counted in that year. |
| Future goals | Child's college, wedding, a car replacement. Enter the cost for one year in today's money, the first payment age, and the number of years. Each year's payment is inflated separately; use 1 year for a single payment. |
| Assumptions | General, healthcare and education inflation, return after retiring, safe withdrawal rate, yearly SIP step-up, medical or emergency reserve. |

The page loads with example figures. Edit, add or remove rows, or hit **Reset**. Changing your current age shifts retirement, spouse, income-start, income-stop, goal and plan-until ages by the same number of years, keeping their timing relative to today. Income rows that have the default stop age of 120 continue to the plan horizon. Plan-until age stops at 100, including when a current-age change would shift it higher. Changing a spouse's age shifts their retirement age. You can then adjust any age separately. Invalid values stop the calculation until corrected. If a goal before retirement cannot be fully funded when it is due, the planned corpus is marked unavailable and the extra SIP calculation includes that goal.

## How the FIRE number is calculated

The result is the higher of two figures:

1. Rule of thumb: net yearly spending at retirement (after income already flowing) divided by the safe withdrawal rate, plus the present value of EMIs still due, each goal payment due after retirement, and the medical reserve.
2. Cash-flow check: the smallest corpus that survives a year-by-year drawdown to your plan-until age, with spending, EMIs, each goal payment and income within its age range applied each year, plus the untouched reserve.

The "How the FIRE number is built" panel in the app shows each line.

### Monthly cash flow in the guided view

The **Monthly cash flow** tab starts with the projected corpus at your planned retirement age, or with **Investments today** if you select **Retire today**. Each month's withdrawal combines living costs and EMIs, less income and any SIPs that continue while their owner is still working. Yearly expenses are spread across the months; future goals are deducted as year-end lump sums. Interest is calculated on the balance after the withdrawal using the post-retirement annual return divided by 12.

**Yearly inc** shows the change in monthly withdrawal at the start of a new year. **Yearly exp** totals that year's withdrawals and lump sums. **RoI chg** is blank because the plan uses one fixed post-retirement return. The table is a read-only illustration; its month-by-month timing can produce different balances from the annual Outlook calculation.

## Running it

Use it online at https://ukkit.github.io/FIREdrill/.

For a guided layout, open [tabbed.html](tabbed.html) from the served folder (or `/tabbed.html` on the same host). Its Overview explains the calculator; Household, Spending, Investments and Future plans collect inputs; the gold-marked Outlook tab shows the two main results; Assumptions and Insights provide the rates and detailed views; Monthly cash flow shows the projection table. The guided view uses the same colors as `index.html`, which remains the single-page view.

To run it yourself, download or clone the repo and serve the folder:

```sh
python3 -m http.server
```

Then open http://localhost:8000 in a browser. Opening `index.html` directly also works when `csv-plan.js` is in the same folder.

These are static files, so any static host will serve the folder. **Keep `csv-plan.js` beside `index.html` and `tabbed.html` when copying or hosting the calculator.** Both pages load that JavaScript file to initialize CSV import and export; they will not initialize if it is missing. **Export CSV** downloads the current inputs as `firedrill_<ddmmyy>_<hhmmss>.csv`, using your local date and time. **Import CSV** restores a file exported by either layout and replaces the current inputs after validating the whole file. Current exports use `firedrill-csv-v2`; older `firedrill-csv-v1` exports still import. A successful import notice clears after five seconds; errors remain visible. Keep the CSV private: it contains your financial figures. No library or internet connection is needed to run the calculator or use CSV files.

## Privacy

Inputs are kept in the browser's `sessionStorage` for the current tab only. The calculator makes no network requests after page load and does not upload inputs or imported CSV files. The tab's stored data is normally cleared when the tab closes, subject to browser session-restore behavior. An exported CSV remains on your device until you delete it.

## Limitations

- Returns and inflation are steady yearly rates. Real markets vary, and sequence-of-returns risk is not modelled.
- Taxes on withdrawals and capital gains are not modelled.
- The home you live in is left out of investments.

This is a planning aid and is not financial advice. A SEBI-registered investment advisor can stress-test your plan.
