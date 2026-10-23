# Betting / raffle payout models: research brief

**Audience:** small community app (Firestore + Cloud Functions), Spanish (es-MX). **Research date:** 2026-10-22. This is product/engineering research, not legal advice. Whether taking money, fees, or running a chance-based prize is lawful depends on jurisdiction and details; obtain local Mexican legal advice before launch. Sources below describe cited products/markets, not endorsement or a claim they are lawful for this use.

## 1. Models in practice

### Fixed-odds bookmaker (operator takes the other side)
The operator posts odds before acceptance. Decimal odds `d` mean total return (stake included) = `stake × d`; net profit is `stake × (d−1)`. Odds encode an implied probability; for decimal odds, `q=1/d`. For a complete outcome set, the sum of implied probabilities typically exceeds 1; `overround = Σq−1` is the book's theoretical margin, not guaranteed realized profit. The operator prices/limits exposure and owes the quoted return even if later customer flow is lopsided. Settlement applies the predeclared result/void rules and credits winners.

**Margin & integrity:** margin is embedded in offered prices (and sometimes explicit fees), not deducted as an after-the-fact pool fee. Key risks: stale odds, insider information, operator exposure, organizer changing odds after bets, fabricated/ambiguous results, duplicate/refunded tickets, and rounding. Freeze and version terms at acceptance, use auditable result sources, immutable bets, idempotent settlement, and a ledger.

### Pari-mutuel / totalisator pool
All stakes across choices enter a pool `P`; the operator removes a disclosed takeout `t`, leaving `D=P(1−t)`. If outcome `j` wins and its stake pool is `Wj>0`, each winning ticket with stake `s` receives gross `s×D/Wj` (subject to disclosed rounding/breakage). Approximate decimal return for that selection is `D/Wj`. The price is unknown until betting closes because it depends on the final pool. Takeout is the operator margin; unlike fixed odds the operator does not usually guarantee a particular payout.

**Zero winners:** if `Wj=0`, formula divides by zero. Rules must decide whether to refund all stakes, roll the pool over, or apply a different stated rule; refund is simplest for community trust. Also decide treatment of void/postponed events, dead heats, ties, cancellations, and minor-unit rounding. Because tickets can be bought late to move the payoff, publish live pool shares and close atomically. Totalisator describes pooling/takeout/proportional winnings; official rates vary by jurisdiction and wager type. [Totalisator TAB (NT)](https://bureauofbookmaking.com.au/nt/totalisator-tab); [Laurel Park parimutuel guide](https://www.laurelpark.com/sites/www.laurelpark.com/files/content/racing-101/Beginners_Guide_to_Parimutuel_wagering.pdf)

### Exchange / matched peer-to-peer market
Backers and layers place opposing offers; odds emerge from available bids/asks and a trade is matched only when prices and quantities cross. An exchange does not normally promise a pool payout or set bookmaker odds: counterparties fund positions. A commission, commonly on a user's net market winnings, is taken after settlement. Betfair says commission is calculated on net market winnings, with rate affected by market/region/discount. [Betfair: commission calculation](https://support.betfair.com/app/answers/detail/413-exchange-what-is-commission-and-how-is-it-calculated/)

**Integrity/operations:** requires a matching engine, escrow/available-balance reservations, partial fills, unmatched-order cancellation, counterparty default handling, exposure/margin controls, and careful simultaneous settlement. Thin community liquidity means many offers will not match; significantly more complexity than a pool. It is not equivalent to simply letting users pick outcomes in a shared pot.

### Prediction-market contracts (related, not the same as a pool)
Binary event contracts can trade at prices in cents that imply market probability; a winning contract redeems at a fixed amount (often $1) and losing at $0. In a multi-outcome market, prices need not sum exactly to 1 because of spreads, fees, and liquidity. Exchange trades clear between participants; the platform may charge trading fees. Resolution must follow explicit event rules and an authoritative source. Kalshi documents $1/$0 binary settlement; Polymarket documents positions/shares and resolution. [Kalshi settlement docs](https://docs.kalshi.com/getting_started/market_settlement); [Polymarket positions](https://docs.polymarket.com/concepts/positions-tokens); [Polymarket fees](https://docs.polymarket.com/trading/fees)

### Simple fixed-prize community raffle
Sell numbered tickets at a fixed price; choose one (or more) winning ticket(s) at random; prize is specified in advance. There are no prediction odds: before the draw, a ticket has probability `winning tickets / eligible tickets sold` (if all tickets have equal chance). Operator economics are ticket revenue less fixed/announced prize and costs. If ticket count/prize is fixed, payout is predictable, but organizer bears shortfall risk if sales are low unless the rules set a minimum-sales threshold and refund condition.

**Integrity:** define ticket issuance/eligibility, cutoff, draw algorithm/seed and audit trail, independent witness or verifiable random source, duplicate prevention, no post-close edits, unclaimed-prize handling, and cancellations/refunds. Do not market an estimated chance as guaranteed when ticket count is not yet known.

## 2. Product examples

1. **DraftKings Sportsbook** — Its odds help explains American odds and decimal odds; for decimal format, stake multiplied by odds gives total return including stake (e.g. 2.50 on $100 returns $250). Fixed odds are offered at bet placement, with operator pricing rather than a community pool. [DraftKings odds calculator](https://sportsbook.draftkings.com/help/how-to-bet/odds-calculator)
2. **FanDuel Sportsbook** — Its betting guide explains + odds as profit per $100 and − odds as the amount risked to win $100; the stake is included in total return. This is fixed-odds bookmaker presentation, not pool redistribution. [FanDuel betting guide](https://www.fanduel.com/research/masters-betting-odds-explained)
3. **Betfair Exchange** — Users match against other users at offered odds; Betfair's support says commission is charged on net winnings in a market, not each losing bet. This puts the fee after the matched market's outcome rather than as a takeout from an undifferentiated pool. [Betfair commission FAQ](https://support.betfair.com/app/answers/detail/413-exchange-what-is-commission-and-how-is-it-calculated/)
4. **Pari-mutuel horse-racing / Totalisator TAB** — The totalisator pools stakes, subtracts takeout, and distributes the remainder among winning tickets proportionally; payout varies with pool composition until close. Exact takeout and breakage rules depend on locale and bet type. [TAB NT explanation](https://bureauofbookmaking.com.au/nt/totalisator-tab); [Florida statute definition](https://www.flsenate.gov/Laws/Statutes/2022/550.002)
5. **Kalshi** — Binary contracts settle at $1 for the winning side and $0 for the losing side according to published market settlement rules. This is contract trading/clearing, not a pooled prize split. [Kalshi settlement docs](https://docs.kalshi.com/getting_started/market_settlement)
6. **Polymarket** — Its docs describe outcome position tokens and market resolution; winning positions can be redeemed according to the resolved outcome, while trading fees may apply before resolution. It resembles a prediction-market share more than a ticket raffle. [Positions](https://docs.polymarket.com/concepts/positions-tokens); [resolution](https://docs.polymarket.com/concepts/resolution)

These are real named services, but their commercial/legal operations are not a template for a small private community app. DraftKings/FanDuel links are official help/editorial pages; the pool explanation is a regulator/statutory source plus TAB operator info.

## 3. Recommendation for the described 3-outcome match

**Best fit: disclosed pari-mutuel pool with fixed-price tickets and a fixed take rate**, not fixed odds. It fits tickets pre-sold at a fixed price and gives the organizer predictable revenue as a percentage of total collected stakes, while participants share the remaining pool on the correctly selected outcome. For Team A / Team B / tie, if pool is $10,000 (MXN equivalent), take is 10%, and winning selection has $2,000 staked, distributable is $9,000 and winning tickets divide that $9,000 proportionally; effective gross return per unit stake is 4.5x before rounding.

**Important nuance:** predictable *margin percentage* does not mean predictable fixed peso profit; profit is `take × collected stakes`, so low sales yield low revenue. If the organizer wants a predictable fixed peso surplus regardless of ticket volume, a disclosed fixed prize/raffle or a fixed organizer fee is more appropriate, but the organizer must fund any shortfall or apply an explicit minimum-sales/refund rule.

**Tradeoffs plainly:**
- **Transparency:** show total pool, take rate, each outcome's stake total and indicative payout; label it “estimado, cambia hasta el cierre”. Final return is unknowable until close.
- **Zero stakes on winning outcome:** no winners. Recommended policy: refund every ticket in full; do not silently keep the pot or reassign the win. It means no organizer take on that event if refunds are gross.
- **Void/cancel/postponed:** publish a deadline and refund policy up front; simplest default is refund all stakes, no fee retained. A postponement can either move the market to a clearly stated new date with explicit consent, or be treated as void.
- **Tie:** define it as an explicit third outcome (not “push”) and identify the official score/result source; if match is abandoned with no official result, void/refund.
- **Rounding:** calculate in integer centavos, allocate largest-remainder cents proportionally, and disclose any remainder rule; never let floating-point arithmetic create/destroy funds.
- **Regulatory caveat:** taking paid stakes and paying based on sporting outcomes may fall under regulated gambling or other laws. Have Mexican counsel determine legality, licensing, age, payment, tax, and consumer-protection requirements before accepting money.

## 4. Implementation sketches (stack-agnostic)

Shared controls for any model: store money as integer minor units (MXN centavos); make accepted ticket records immutable; transactionally check event status/cutoff and record payment exactly once; retain an append-only ledger; derive totals from authoritative accepted entries; restrict settlement to authorized role; store result source, actor, timestamp, rule/version; settlement function must be idempotent (same result applied twice creates no second payout). Display the rules before purchase and snapshot them with each ticket.

### A. Pari-mutuel (recommended)

```text
create event(outcomes=[A,B,TIE], ticketPrice, takeRate, closeAt, rulesVersion)
accept ticket(user, outcome, qty):
  transaction:
    require event.status == OPEN and now < closeAt
    charge/confirm ticketPrice * qty exactly once
    create immutable ticket(id, user, outcome, qty, stake, rulesVersion)
    update pool totals (or recompute from tickets)

quote():
  P = sum(accepted stakes); D = floor_to_centavo(P * (1 - takeRate))
  for each outcome j:
    Wj = stakes on j
    if Wj > 0: indicativeGrossMultiplier[j] = D / Wj
  return totals + as-of timestamp + "estimado"

settle(officialOutcome):
  transaction:
    require status == CLOSED and settlement not already applied
    record source/evidence/actor; freeze accepted ticket set
    P = total stakes; W = winning outcome stakes; D = P - disclosed take
    if event void OR W == 0: refund every ticket's full stake; organizerTake = 0
    else:
      allocate D among winning tickets proportional to stake in centavos
      distribute remainder cents by deterministic largest-remainder rule
      pay winners; record take = P - D (subject to explicit unclaimed policy)
    mark SETTLED with unique settlementId
```

**Spanish UI:** “Pozo total: $X MXN”; “Aportación de organización: 10% ($Y)”; “Si gana Equipo A: pago estimado $Z por cada $10 apostados”; “Estimado: cambia hasta el cierre”; explain returned amount includes stake. Avoid “cuota fija”.

### B. Fixed odds / fixed payout (viable only with risk controls)

```text
publish prices odds[j] as decimal gross multipliers and lock version/time
buy(user, outcome, stake):
  transaction:
    require open and under per-user/per-outcome liability caps
    snapshot oddsVersion and quoted odds on immutable ticket
    accept payment; reserve liability = stake * (odds - 1)
settle(result):
  if void: refund stakes per rules
  else pay each winner stake * lockedOdds (including stake)
  calculate realized operator P&L = losing stakes - winner profits (minus refunds)
```

The book must choose odds whose implied probabilities include margin (`Σ1/odds > 1`) and ensure worst-case liability is affordable. A non-technical user display should show “Apuestas $100 → recibes $X en total si aciertas (incluye tus $100)” and lock that amount at purchase. In a three-way market, avoid changing odds on accepted tickets; updating quotes affects only future tickets. Margin is statistical/theoretical, not guaranteed profit on each match.

### C. Fixed-prize raffle (viable if certainty of organizer economics matters)

```text
create raffle(ticketPrice, prizeAmount, maxTickets, minimumSales, closeAt, drawRules)
sell ticket: atomically issue unique sequential/random ticket number after payment
close: lock sales; if sales < minimumSales => refund all (or apply other stated rule)
else:
  select winner with auditable unbiased draw from eligible ticket IDs
  record seed/method/witness and winner; pay fixed prize once
```

Display: “Cada boleto cuesta $X”; “Premio: $Y”; “Boletos vendidos: N”; “Probabilidad actual aproximada: 1 de N” only if one winner and all tickets equally eligible; state chance changes as sales change. This gives a fixed prize and the organizer's revenue depends on sales minus prize/costs; minimum-sales rule protects against underselling but requires refunds if missed.

## 5. Sources and uncertainty

- DraftKings official [odds calculator](https://sportsbook.draftkings.com/help/how-to-bet/odds-calculator).
- FanDuel [odds guide](https://www.fanduel.com/research/masters-betting-odds-explained).
- Betfair official [commission calculation](https://support.betfair.com/app/answers/detail/413-exchange-what-is-commission-and-how-is-it-calculated/).
- Totalisator TAB [pari-mutuel overview](https://bureauofbookmaking.com.au/nt/totalisator-tab); Laurel Park [beginner guide](https://www.laurelpark.com/sites/www.laurelpark.com/files/content/racing-101/Beginners_Guide_to_Parimutuel_wagering.pdf); Florida [statutory definition](https://www.flsenate.gov/Laws/Statutes/2022/550.002).
- Kalshi [market settlement documentation](https://docs.kalshi.com/getting_started/market_settlement).
- Polymarket [positions](https://docs.polymarket.com/concepts/positions-tokens), [resolution](https://docs.polymarket.com/concepts/resolution), and [fees](https://docs.polymarket.com/trading/fees).

**Uncertainty/limits:** Product rules, fees, regional availability, and law can change. Sportsbook odds/margin formulas here are standard interpretations of cited odds display; the operator's complete risk/pricing algorithm is proprietary and not inferred. Exact pari-mutuel takeout, breakage, refunds, and unclaimed-prize rules vary by jurisdiction and pool. This brief did not verify Mexican law or whether any specific implementation is lawful. No suitable, independently verified GitHub community-app implementation was established in this research, so none is cited as an authoritative model.
