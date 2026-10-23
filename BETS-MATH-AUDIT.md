# Bets Math Audit — `new-raffles-app` @ `design/ratified-decisions`

Scope: read-only audit of the betting math as implemented today. Files read:
`app/bet/[id]/BetPageClient.tsx`, `functions/src/index.ts`,
`app/components/BetSaleCard.tsx`, `app/store.tsx`, `app/admin/create/bet/page.tsx`,
`app/admin/bets/page.tsx`.

No model is proposed here. This document only states what the current code
computes and where it breaks.

Terminology used below:
- **ticket** = one unit sold at `pricePerTicket`.
- **counter** = `betsTeamA` / `betsTeamB` / `tieBets`, which are *ticket counts*,
  written in RTDB at `bets/{betId}`.
- **pool** (money) = `(betsTeamA + betsTeamB + tieBets) × pricePerTicket`.

---

## 1. What the current math does

### 1.1 Source of the numbers

| Value | Where it comes from | file:line |
|---|---|---|
| `pricePerTicket` | bet doc, admin-entered | `functions/src/index.ts:2088` (create), `:1340` (re-validated on purchase) |
| `betsTeamA` / `betsTeamB` / `tieBets` | RTDB `bets/{id}`, initialized to `0` | `functions/src/index.ts:2093-2095` |
| `initialPool` | initialized to `0`, **never updated, never read by math** | `functions/src/index.ts:2096` |
| `oddsTeamA` / `oddsTeamB` / `oddsTie` | admin-entered **strings**, default `"1.0"`; **never used in any calculation** | `functions/src/index.ts:2090-2092` |
| `clientReturns` | computed in the browser, never persisted server-side | `BetPageClient.tsx:291` |

Counters are only ever moved by `confirmRejectBetSale`:

```
betsTeamA ← betsTeamA ± bet.ticketNumbers
betsTeamB ← betsTeamB ± bet.ticketNumbers
tieBets   ← tieBets   ± bet.ticketNumbers
totalBets ← totalBets ± bet.ticketNumbers
```
`functions/src/index.ts:1988-1997` (confirm) and `:2005-2019` (reject).

### 1.2 `totalTickets` and `totalPrice` — the buyer's own stake

```ts
// BetPageClient.tsx:85-92
totalTickets = ticketsTeamA + ticketsTeamB + tieTickets
totalPrice   = pricePerTicket * totalTickets
```
The buyer's stake is in currency and is correct, **provided** `pricePerTicket`
is a number and only one team's counter can be non-zero. `updateTickets` resets
the other two counters whenever a team is incremented
(`BetPageClient.tsx:247-252`), so in practice `totalTickets` = the selection on
one team.

### 1.3 `calculateGain` → `potentialWinnings` → `clientReturns`

This is the only value that is stored as the customer's expected payout
(`BetPageClient.tsx:291`, field `clientReturns`).

```ts
// BetPageClient.tsx:94-119
totalBets = betsTeamA + betsTeamB + tieBets

winPerTicket:
  A: betsTeamA === 0 ? totalBets : totalBets / betsTeamA
  B: betsTeamB === 0 ? totalBets : totalBets / betsTeamB + betsTeamB
  C: tieBets   === 0 ? totalBets : totalBets / tieBets   + tieBets

return winPerTicket * numberOfTickets
```

Three properties to note:

1. `totalBets / betsTeamX` is a **dimensionless ratio** (payout multiple), used
   as if it were currency per ticket.
2. The `+ betsTeamX` term in the **B and C branches only** is a raw ticket
   count added to a ratio. Mixed units, and asymmetric — branch A doesn't have it.
3. **`pricePerTicket` never enters this function.** `clientReturns` is therefore
   in ticket units, not pesos.

The `betsTeamX === 0 ?` guards exist only to avoid `Infinity`; they substitute a
ticket count (`totalBets`) for the ratio, which is also dimensionally wrong.

### 1.4 `calculateOdds` — decimal and American odds

```ts
// BetPageClient.tsx:129-181
totalBets = betsTeamA + betsTeamB + tieBets
if (totalBets === 0) return "+100"
teamBets = {A: betsTeamA, B: betsTeamB, C: tieBets}[team]
if (teamBets === 0) return "+100"

p         = teamBets / totalBets                 // "probabilidad real"
overround = 1.1                                  // hard-coded 10% vig
adj       = p * overround
decimal   = 1 / adj

if (decimal >= 2) return "+" + ((decimal - 1) * 100).toFixed(0)
else              return         (-100 / (decimal - 1)).toFixed(0)
```

So the *displayed* decimal odds are `1 / (1.1 × p)` and the implied
probabilities sum to `1.1` (110% book).

### 1.5 `calculateAmericanOddsWinnings` — displayed "Gana" amount

```ts
// BetPageClient.tsx:185-213
if (betAmount === 0) return 0
odds       = calculateOdds(team)
numericOdds = parseInt(odds.replace(/[+\-]/g, ""))   // sign is dropped
winnings = odds.startsWith("-")
  ? (100 / numericOdds) * betAmount
  : (numericOdds / 100) * betAmount
return winnings + Number(betAmount)                   // payout, incl. stake
```

Used in two places:
- Team cards: `calculateAmericanOddsWinnings(team, pricePerTicket)` — payout for
  **one** ticket, labelled `Gana:` (`BetPageClient.tsx:326-329`).
- Bottom bar: `calculateAmericanOddsWinnings(selectedLetterTeam, totalPrice)` —
  payout for the whole stake, labelled `Gana hasta` (`BetPageClient.tsx:484-492`).

There are therefore **two independent payout formulas live in the same screen**:
`calculateGain` (1.3) feeds `clientReturns`/the cart, and
`calculateAmericanOddsWinnings` (1.5) feeds the pixels. They disagree by orders
of magnitude (§2.2).

---

## 2. Correctness check with worked numbers

Baseline scenario: `pricePerTicket = $50`, counters `A = 40, B = 35, Tie = 25`.
Then `totalBets = 100` tickets, **money pool = $5,000**.

Ground truth for a pari-mutuel pool that returns 100% of stakes:
payout per winning ticket = `pool / winningTickets`.

| Outcome | True payout / ticket | True profit / ticket |
|---|---|---|
| A wins | 5000 / 40 = **$125.00** | $75.00 |
| B wins | 5000 / 35 = **$142.86** | $92.86 |
| Tie | 5000 / 25 = **$200.00** | $150.00 |

### 2.1 `calculateGain` (§1.3)

| Team | `winPerTicket` | ×10 tickets → `clientReturns` | Correct (10 tkts, $500 stake) | Error |
|---|---|---|---|---|
| A | 100/40 = 2.5 | **25** | 1,250 | pays 2% of what is owed |
| B | 100/35 + 35 = 37.8571 | **378.57** | 1,428.57 | pays 26.5% |
| C | 100/25 + 25 = 29 | **290** | 2,000 | pays 14.5% |

Read as a *multiple of stake* (because the number is neither currency nor a
ratio, this is the only way it can be interpreted): A pays **0.05×**,
B pays **0.757×**, C pays **0.58×**. On every bet, the recorded payout is less
than the money the customer handed over.

**Does `winPerTicket` sum exceed the pool?** Summed over the winning side's own
tickets (`winningTickets × winPerTicket`):

| Team | Sum promised | Pool (ticket units = 100) | Ratio |
|---|---|---|---|
| A | 40 × 2.5 = 100 | 100 | 1.00× (equal, but in tickets not pesos → 2% of the $5,000 actually collected) |
| B | 35 × 37.857 = **1,325** | 100 | **13.25×** |
| C | 25 × 29 = **725** | 100 | **7.25×** |

So for A the app promises exactly the pool but in the wrong unit; for B and C it
promises **more than 7–13× the money it collected**. Both directions of
failure exist in the same function, decided by which team the customer picked.

### 2.2 `calculateOdds` + `calculateAmericanOddsWinnings` (§1.4–1.5)

| Team | p | adj = 1.1p | decimal | American (string) | Payout for $50 ticket | True payout | Error |
|---|---|---|---|---|---|---|---|
| A | 0.40 | 0.44 | 2.2727 | `+127` | $113.50 | $125.00 | −9.2% |
| B | 0.35 | 0.385 | 2.5974 | `+160` | $130.00 | $142.86 | −9.0% |
| C | 0.25 | 0.275 | 3.6364 | `+264` | $182.00 | $200.00 | −9.0% |

The uniform ≈ −9.09% deviation is exactly `1/1.1`. It is not a rounding issue:
the code advertises a 110% book while the pool (as modelled by the counters)
pays 100% of stakes. No code path retains the 10% — there is no rake field and
no settlement function — so the "vig" is a display-only haircut that makes every
advertised payout wrong by a constant factor.

### 2.3 Division-by-zero handling

Three distinct guards, all wrong in different ways (example `A = 0, B = 35, C = 25`,
`totalBets = 60`, pool = $3,000, buyer takes 1 ticket on A):

| Path | Value produced | Truth (1 winning ticket of 60) |
|---|---|---|
| `calculateGain("A")` | `totalBets` = **60** | $3,000 |
| `calculateOdds("A")` | `"+100"` → payout **$100** | $3,000 |

Two incompatible fallbacks for the same state, both ~30× too low, and the
`+100` fallback also fires whenever a team simply has no bets yet — which is
precisely the state of a brand-new bet.

### 2.4 Does the winner's own stake count?

Three different answers in the same codebase:

- `totalBets / winnerTickets` (§1.3) — numerator **includes** the winner's own
  stake, so the quotient already contains the stake return. Correct for
  pari-mutuel *in ticket units*.
- `+ betsTeamB` (§1.3, B and C branches) — adds the winning ticket count a
  **second time**, as a raw number.
- `winnings + betAmount` (§1.5) — adds the stake back on top of American odds,
  which are already a profit quote. Correct for a fixed-odds book, wrong for a
  pari-mutuel pool, and inconsistent with the previous two.

### 2.5 Rounding and currency representation

- American odds are rounded with `toFixed(0)` and then re-parsed with
  `parseInt` (`BetPageClient.tsx:171-176`, `:190`). A 0.5 rounding on `+127`
  is ≈0.4% of the payout; on short negative odds the error is larger.
- Sign is discarded and re-derived from `odds.startsWith("-")`
  (`:190`, `:198`). When `toFixed(0)` produces a value that *should* be negative
  but the branch that formats it omits the `+`, the sign is lost — see bug **M1**.
- `pricePerTicket` is a float; `totalPrice = pricePerTicket * totalTickets`
  (`:89-92`) and `clientReturns` are never rounded to cents. `12.1 × 3` yields
  `36.300000000000004` in JS. `formatPrice` only formats at render.
- `clientReturns` is stored in `localStorage` (zustand persist) and shown to
  admins as a currency amount (`BetSaleCard.tsx:136-138`) with no unit
  conversion anywhere.

---

## 3. Cross-check against `confirmRejectBetSale`

### 3.1 Do the counter updates match what the client math assumes?

**Units: yes.** `betsTeamA += bet.ticketNumbers` (`index.ts:1988-1990`) adds a
ticket count to a ticket count. The client reads the same counters and computes
`p = teamBets / totalBets` (`BetPageClient.tsx:157`), which is a *money* share
only because every ticket on a bet has the same price. That part is coherent.

**Everything downstream of the counter is not.** The client never multiplies by
`pricePerTicket` in the payout path, so the counters are correct and the money
conversion is missing.

Three definitions of "total" coexist:
- client math: `betsTeamA + betsTeamB + tieBets` (`BetPageClient.tsx:99`, `:133`);
- admin bets page: `bet.betsTeamA + bet.betsTeamB + (bet.tieBets || 0)` (`app/admin/bets/page.tsx:242`);
- server field `totalBets` maintained separately (`index.ts:1996`, `:2017`) and
  **never initialized by `createBet`** (`index.ts:2083-2101` has no `totalBets`;
  only the admin form sends `totalBets: 0`, `app/admin/create/bet/page.tsx:178`).

### 3.2 The client-trust problem (B1) and how it distorts the math

The counters are the denominators of every payout, so anything that can inflate
them changes every other customer's payout.

1. **`ticketNumbers` is re-played, not recomputed.**
   `confirmRejectBetSale` trusts `bet.ticketNumbers` from the sale document:
   `updates.betsTeamA = Number(betData.betsTeamA || 0) + bet.ticketNumbers`
   (`index.ts:1988-1994`). It never checks
   `bet.totalPrice === pricePerTicket × bet.ticketNumbers`, never checks that
   `bet.team` is one of `A|B|C`, and never checks the bet is still open.
2. **There is no `Number()` on the operand.** If `ticketNumbers` arrives as a
   string (possible via the legacy `checkTransfer` path, which stores the
   browser's `bets` array verbatim, `index.ts:1006-1014`, with no validation),
   `+` concatenates: `"0" + "10"` → `"010"`. The client then computes
   `betsTeamA + betsTeamB + tieBets` (`:99`) as string concatenation and every
   probability becomes `NaN` or garbage.
3. **Read-modify-write without a transaction.** `realTimeDbRef.once("value")`
   at `:1967` then `update()` at `:1997`. Two admins confirming different sales
   on the same bet concurrently will lose one increment. Firestore has a
   transaction here; RTDB does not.
4. **Not idempotent.** Confirming the same sale twice adds the tickets twice
   (`:1988-1997`). The admin card toggles `verified` locally
   (`BetSaleCard.tsx:68-72`), so a double-click that races the UI state
   double-counts. Effect: the winning side's payout ratio drops for everyone.
5. **Reject can go negative.** `:2005-2019` subtracts unconditionally, with no
   check that this sale was ever confirmed. `betsTeamA = -10` makes
   `p` negative, `1/(1.1p)` negative, and the American conversion
   `-100/(decimal-1)` positive — an odds string is produced from an impossible
   state.
6. **`totalBets` drifts.** `:1996` increments `totalBets` for **every** line,
   even when `bet.team` matched none of `A|B|C` (legacy docs whose `bets[]`
   entries lack `letterTeam`). Then `totalBets ≠ A+B+C` forever.

### 3.3 `clientReturns` written to the sale is always 0

`index.ts:1980-1983` and `:2000-2003` write:

```ts
await saleRef.update({ verified, clientReturns: betData.clientReturns || 0 });
```

`betData` is the **bet document** (`bets/{betId}`), not the sale line. Bets
created by `createBet` have no `clientReturns` field (`:2083-2101`), so this
always stores `0`. The value `BetSaleCard` actually sends per line
(`betSale.clientReturns`, `BetSaleCard.tsx:59`) is ignored by the server
entirely, and the transfer flow never records it either
(`createTransferSale` builds `betLines` without `clientReturns`,
`index.ts:1356-1364`). The chain that would carry the customer's quoted payout
to the admin is broken at three points, so the number an admin would pay from is
never persisted.

---

## 4. Edge cases

| Case | What happens today |
|---|---|
| **Nobody bet the winning team** | No code path exists. `isFinished` is a manual checkbox (`index.ts:1820`-ish updateBet, `app/admin/bets/page.tsx:309`); there is no settlement function, no winner field on bets, and no payout code. Mathematically the pool would divide by zero winners — the code neither pays nor refunds nor records anything. |
| **Single bettor** (`A=1, B=0, C=0`, price 50) | `calculateGain` → `totalBets/1 = 1` per ticket → `clientReturns = 1` for a $50 stake. `calculateOdds` → `p=1`, `adj=1.1`, `decimal=0.909` (< 1, impossible in real betting), `-100/(0.909-1)` = **+1100**, formatted as `"1100"` (no sign) → treated as positive → displayed payout **$600** from a $50 pool. Two screens, two absurd but different answers. |
| **Tie outcome** | Same broken B/C branch (`+ tieBets`). Additionally, if the admin set `oddsTie`, the tie card is **hidden** (`BetPageClient.tsx:330-332`, `if (teamKey === "C" && realtimeBetData.oddsTie) return null`) — so the tie counter exists and is used in `totalBets`, but customers cannot bet it on any bet that configured tie odds. |
| **Refund semantics** | Undefined. Rejecting a sale decrements counters (`:2005-2019`) but `verified` is a plain boolean toggle; nothing prevents rejecting an already-rejected sale, and no refund amount is computed. |
| **Partially-filled pool** | Treated as complete. Odds are recomputed live on every counter change, and the buyer's `clientReturns` is frozen at add-to-cart time (`BetPageClient.tsx:291`), then frozen again in `localStorage`. The last buyer's stake changes everyone's payout after the quoted numbers were captured. |
| **Bet closed (`isFinished`)** | Only a CSS class (`BetPageClient.tsx:430`). `confirmRejectBetSale` accepts sales after `isFinished`, so counters — and therefore all payouts — can move after the event ended. |
| **New bet, no bets yet** | `totalBets === 0` → `"+100"` (`:140`) → "Gana" = 2× stake, and `calculateGain` returns `0`. |

---

## 5. Concrete math bugs found

**M1 — Sign inversion when a team's probability ≥ 90.9%** (`BetPageClient.tsx:166-179`)
When `p ≥ 1/1.1 = 0.9091`, `decimal = 1/(1.1p) ≤ 1`, so the `else` branch computes
`-100 / (decimal - 1)` with a *negative* denominator and returns a large
**positive** number, formatted without a `+`.
Example `A=95, B=3, Tie=2`, pool $5,000: `decimal = 0.9569`,
`-100/(0.9569-1) = +2322` → string `"2322"` → `parseInt` → positive →
payout `50 × 23.22 + 50 = **$1,211**` for a $50 ticket whose true payout is
`5000/95 = $52.63`. Over-promise of ~23×, from a pool that cannot cover it.
This is the most dangerous one: it is reachable on any lopsided bet.

**M2 — `+ betsTeamX` in the B and C branches only** (`BetPageClient.tsx:106-114`)
A ticket count is added to a dimensionless ratio. With `40/35/25`, one ticket on
B is quoted `37.857` and one ticket on A is quoted `2.5` — a **15.1×** premium
for a team that is only 12.5% less likely. Summing over winners:
B → `35 × 37.857 = 1,325` against a pool of 100 ticket units (**13.25×**);
C → `725` (**7.25×**). The app can promise more money than it collected.

**M3 — `clientReturns` is in ticket units, never converted to currency**
(`BetPageClient.tsx:94-119` used at `:291`)
`pricePerTicket` never appears in `calculateGain`. With `A=40, B=35, Tie=25`,
$50/ticket and 10 tickets on A, the stored payout is `25` against a stake of
`$500` and a true payout of `$1,250`. Every bet is recorded as paying 2–76% of
its own stake.

**M4 — Two payout formulas disagreeing on the same screen**
(`BetPageClient.tsx:121-127` vs `:326-329`, `:484-492`)
Cart/`clientReturns` uses `calculateGain`; the visible "Gana" uses American odds.
For 10 tickets on B ($500): card math says `$378.57`, `clientReturns` says
`378.57`, true pool says `$1,428.57`, and the per-ticket "Gana" says `$130` —
which ×10 is `$1,300`. A customer comparing the card to the cart sees two
different promises for the same purchase.

**M5 — Hard-coded 10% overround applied to a 100%-payout pool**
(`BetPageClient.tsx:161-166`)
`decimal = 1/(1.1p)` understates every payout by exactly `9.09%` (§2.2). The
0.1 is never collected or recorded anywhere — no rake field, no settlement — so
it is pure mispricing, not margin.

**M6 — Division-by-zero guards substitute a ticket count for a ratio**
(`BetPageClient.tsx:104`, `:108`, `:112`, `:152`)
`A=0,B=35,C=25` → `calculateGain("A") = 60` while `calculateOdds("A") = "+100"`
(payout $100). Truth: the single ticket that opens team A takes the whole
`$3,000` pool. Two different wrong answers for the state every new bet starts in.

**M7 — Non-idempotent, non-transactional counter updates** (`functions/src/index.ts:1967-1997`)
Confirming the same sale twice (double-click racing the local `verified` toggle
in `BetSaleCard.tsx:68-72`) adds `ticketNumbers` twice; two admins confirming
concurrently lose an increment. Example: `betsTeamA = 40`, a 10-ticket sale
confirmed twice → `60` instead of `50`, so every A winner's ratio falls from
`125` to `104.17` per ticket — a 16.7% haircut caused by an admin misclick.

**M8 — Reject subtracts without checking prior state** (`functions/src/index.ts:2005-2019`)
Rejecting a never-confirmed sale yields `betsTeamA = -10`; `p` becomes negative
and `calculateOdds` returns a positive-looking odds string from a negative
probability.

**M9 — `totalBets` is incremented even when no team matched** (`functions/src/index.ts:1996`, `:2017`)
Legacy `salesBets` docs (written by `checkTransfer`, `:1006-1014`) store the
browser's `bets[]` verbatim; if `letterTeam` is missing, no team counter moves
but `totalBets` still grows. The three "total" definitions then permanently
disagree, and `p = teamBets / (A+B+C)` no longer matches the recorded total.

**M10 — Uncoerced `+` on `ticketNumbers`** (`functions/src/index.ts:1988-1994`)
A string `"10"` concatenates: `0 + "10"` → `"010"`. The client's
`betsTeamA + betsTeamB + tieBets` (`BetPageClient.tsx:99`) then concatenates, and
`1/(1.1 × "010"/...)` produces `NaN` → `$NaN` in the "Gana" box.

**M11 — `clientReturns` written to the sale is always 0** (`functions/src/index.ts:1982`, `:2002`)
Read from the *bet* document, which never has the field (`:2083-2101`), ignoring
the per-line value the admin UI sends (`BetSaleCard.tsx:59`). The payout figure
the whole UI computes is discarded at the only point it is persisted.

**M12 — `oddsTie` hides the tie market** (`BetPageClient.tsx:330-332`, `index.ts:2092`)
Setting the tie-odds string removes the tie card, while `tieBets` still counts
in `totalBets`. A bet can therefore have tie stakes that no new customer can
match, diluting the A/B ratios with money that was never offered.

---

### Out of scope

No replacement model, no fix design, no code changes. This file is the only
artifact written; nothing was committed.
