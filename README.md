# True Money Supply

[truemoneysupply.org](https://truemoneysupply.org)

The True Money Supply is a monetary aggregate developed by Murray Rothbard and Joseph Salerno. Unlike M1, M2, and M3, TMS exclusively counts money available for immediate exchange, which excludes time deposits, money market funds, and other instruments that require conversion before spending. This site aggregates 11 FRED series into a live, interactive visualization of TMS, along with a few other nice visualizations.

## What's on the site

**TMS stacked area chart** — The main chart breaks TMS into its five components: Currency, Demand Deposits, Other Liquid Deposits, U.S. Government Deposits, and Foreign Deposits. M1 and M2 can be toggled as overlay lines for comparison. Click-and-drag to zoom any time range from 1959 to present.

**Components table** — Reference table mapping each component to its inclusion in M1, M2, M3, and TMS, with links to the underlying FRED series.

**MV = PQ decomposition** — Decomposes year-over-year money growth into three destinations using the equation of exchange: real GDP growth (productive absorption), velocity changes, and price inflation. Toggle between TMS and M2 as the money supply input.

**Price level chart** — Shows actual CPI against a counterfactual: where the price level would be had the money supply never grown from 1959. Uses a log scale to make both lines equally visible. An annotation shows the ratio between the two at the rightmost visible point.

## Data sources

All data comes from the [FRED API](https://fred.stlouisfed.org/) (Federal Reserve Economic Data). The server caches responses for one hour.

| Series | Description |
|--------|-------------|
| CURRNS | Currency in Circulation |
| DEMDEPNS | Demand Deposits |
| MDLNM | Other Liquid Deposits (May 2020+) |
| SAVINGNS | Savings Deposits (pre-May 2020) |
| OCDNS | Other Checkable Deposits (pre-May 2020) |
| WTREGEN | Treasury General Account at Fed (2002+) |
| GDBFRW | Government Deposits at Fed (pre-2002) |
| BOGZ1FL763123005Q | Government Deposits at Commercial Banks (quarterly) |
| WDFOL | Foreign Deposits at Fed |
| DDDFOINS, DDDFCBNS | Foreign Deposits at Commercial Banks |
| M1NS, M2NS | M1 and M2 (not seasonally adjusted) |
| CPIAUCNS | CPI for All Urban Consumers (not seasonally adjusted) |
| GDP | Nominal GDP (quarterly) |
| GDPC1 | Real GDP (quarterly) |


## Stack

Bun HTTP server (TypeScript) serving vanilla JS + Highcharts. Zero runtime dependencies.

