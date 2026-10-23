# FIREdrill

A FIRE (Financial Independence, Retire Early) calculator for Indian households. Enter what your household spends, owns and invests, and it works out your FIRE number, whether you are on track, and how long your money lasts if you stop working.

Everything runs in your browser, with no backend, account or build step.

## What it tells you

- FIRE number at your chosen retirement age, in future rupees and in today's money.
- On track or not: projected corpus at retirement against the FIRE number, the surplus or shortfall, and the extra monthly SIP needed to close a gap.
- If you retire tomorrow: how many years your current investments would last, the first-year withdrawal and the withdrawal rate.
- Corpus over time: a chart of both scenarios (retire as planned, retire tomorrow).
- Spending cuts: how much longer the FIRE number lasts if you spend 2% to 10% less after retiring.
- PDF report of your inputs, results and assumptions.

## What you enter

| Section | Notes |
| --- | --- |
| Household | Your age, retirement age, plan-until age. Optionally a spouse with their own age and retirement age. |
| Monthly and yearly expenses | Each row has the share that continues after retiring (0% if it ends, above 100% if it grows) and an inflation type: general, healthcare or education. |
| Loan EMIs | Stop when the loan ends and are not inflated. |
| Existing investments | Equity, EPF, PPF, NPS, FDs, gold and so on, each with its own expected return. Separate columns for you and your spouse. |
| Monthly SIPs | Continue until each person retires and step up yearly. |
| Income after retiring | Rent, pension and similar, from a given age, rising with inflation. |
| One-time goals | Child's college, wedding, a car replacement, paid from investments in the year they fall due. |
| Assumptions | General, healthcare and education inflation, return after retiring, safe withdrawal rate, yearly SIP step-up, medical or emergency reserve. |

The page loads with example figures. Edit, add or remove rows, or hit **Reset to example**.

## How the FIRE number is calculated

The result is the higher of two figures:

1. Rule of thumb: net yearly spending at retirement (after income already flowing) divided by the safe withdrawal rate, plus the present value of EMIs still due, goals due after retirement, and the medical reserve.
2. Cash-flow check: the smallest corpus that survives a year-by-year drawdown to your plan-until age, with spending, EMIs, goals and post-retirement income applied each year, plus the untouched reserve.

The "How the FIRE number is built" panel in the app shows each line.

## Running it

Use it online at https://ukkit.github.io/FIREdrill/.

To run it yourself, download or clone the repo and serve the folder:

```sh
python3 -m http.server
```

Then open http://localhost:8000 in a browser. Opening `index.html` directly also works.

It is a single static file, so any static host will serve it. The PDF export loads [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) from cdnjs, so that one feature needs an internet connection.

## Privacy

Inputs are kept in the browser's `sessionStorage` for the current tab only. Nothing is uploaded or shared, and the data is erased when you close the tab.

## Limitations

- Returns and inflation are steady yearly rates. Real markets vary, and sequence-of-returns risk is not modelled.
- Taxes on withdrawals and capital gains are not modelled.
- The home you live in is left out of investments.

This is a planning aid and is not financial advice. A SEBI-registered investment advisor can stress-test your plan.
