# True Money Supply

[truemoneysupply.org](https://www.truemoneysupply.org)

The True Money Supply is a monetary aggregate developed by Murray Rothbard and Joseph Salerno. Unlike M1, M2, and M3, TMS exclusively counts money available for immediate exchange, which excludes time deposits, money market funds, and other instruments that require conversion before spending. This site aggregates 11 FRED series into a live, interactive visualization of TMS.

## What's on the site

**TMS stacked area chart** — The main chart breaks TMS into its five components: Currency, Demand Deposits, Other Liquid Deposits, U.S. Government Deposits, and Foreign Deposits. M1 and M2 can be toggled as overlay lines for comparison. Click-and-drag to zoom any time range from 1959 to present.

**Components table** — Reference table mapping each component to its inclusion in M1, M2, M3, and TMS, with links to the underlying FRED series.

**MV = PQ decomposition** — Decomposes year-over-year money growth into three destinations using the equation of exchange. Toggle between TMS and M2 as the money supply input.

**Price level chart** — Shows CPI against a counterfactual, namely, where the price level would be had the money supply not grown since 1959.

## Data sources

All data comes from the [FRED API](https://fred.stlouisfed.org/) (Federal Reserve Economic Data).

| Series | Description | Coverage |
|--------|-------------|----------|
| CURRNS | Currency in Circulation | 1959– |
| DEMDEPNS | Demand Deposits | 1959– |
| MDLNM | Other Liquid Deposits | 2020– |
| SAVINGNS | Savings Deposits | 1959–2020 |
| OCDNS | Other Checkable Deposits | 1959–2020 |
| WTREGEN | Treasury General Account at Fed | 2002– |
| GDBFRW | Treasury General Account at Fed | 1975–2002 |
| BOGZ1FL763123005Q | Government Deposits at Commercial Banks | 1959– |
| WDFOL | Foreign Deposits at Fed | 2002– |
| DDDFOINS | Foreign Official Deposits at Commercial Banks | 1959–2021 |
| DDDFCBNS | Foreign Bank Deposits at Commercial Banks | 1959–2021 |
| M1NS | M1 | 1959– |
| M2NS | M2 | 1959– |
| CPIAUCNS | CPI for All Urban Consumers | 1959– |
| GDP | Nominal GDP | 1959– |
| GDPC1 | Real GDP | 1959– |

## Discrepancy with Mises Institute figures

Our TMS figures are roughly $1 trillion higher than those reported in the Mises Institute's money supply updates. Those updates do not describe their method of calculation. However, a [2016 article](https://mises.org/mises-wire/money-supply-growth-remains-stable-84-percent-march) specified a formula that, we believe, subtracts IRA and Keogh balances (roughly $1.2 trillion) twice. We have therefore retained our own calculation.
