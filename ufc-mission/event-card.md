# Event Card — UFC 333: Volkanovski vs. Evloev

Research date: 2026-10-23 18:04 CST (America/Chihuahua). Status: card verified against two sources; odds pending (next cycle).

## Event
- **Event:** UFC 333: Volkanovski vs. Evloev
- **Date:** Saturday, 2026-10-24
- **Venue:** Etihad Arena, Abu Dhabi, UAE
- **Broadcast:** Paramount+ (entire card)

## Local times (America/Chihuahua, CST UTC-6 — note: US Central CDT is UTC-5, so subtract 1h from US Central listings)
| Segment | ET (EDT) | Chihuahua (CST) |
|---|---|---|
| Early prelims | 10:00 AM | 08:00 AM |
| Prelims | 12:00 PM | 10:00 AM |
| Main card | 2:00 PM | 12:00 PM |

## Bout order (source: mmasucka.com full fight card, cross-checked vs Yahoo/CBS previews)

### Main card (12:00 PM CST)
1. (FW title) Alexander Volkanovski (c) vs. Movsar Evloev
2. (BW title) Petr Yan (c) vs. Merab Dvalishvili
3. (Flyweight) Lone'er Kavanagh vs. Ramazan Temirov
4. (Heavyweight) Alexander Volkov vs. Rizvan Kuniev
5. (Featherweight) Aaron Pico vs. Losene Keita

### Prelims (10:00 AM CST)
6. (LHW) Azamat Murzakanov vs. Dominick Reyes
7. (LHW) Nikita Krylov vs. Abdul-Rakhman Yakhyaev
8. (MW) Abusupiyan Magomedov vs. Cameron Rowston
9. (LW) Grant Dawson vs. Nurullo Aliev

### Early prelims (08:00 AM CST)
10. (BW) Colby Thicknesse vs. Asaf Chopurov
11. (MW) Abubakar Vagaev vs. Jacob Malkoun
12. (FW) Bolaji Oki vs. Daniel Santos
13. (LW) Kody Steele vs. Noah Gugnon
14. (WSW) Iasmin Lucindo vs. Nicole Caliari

## Sources
- https://mmasucka.com/previews/ufc-333-how-to-watch-and-full-fight-card/ (full bout order + times, fetched 2026-10-23)
- Yahoo Sports UFC 333 preview; CBS Sports fight-card preview; Paramount+ schedule page (event/date/main+co-main confirmation)

## Notes / risks
- Weigh-in results reported (middleeasy.com: Volkanovski, Evloev, Yan, Caliari weighed) — confirm all 14 made weight next cycle.
- Card changes/cancellations possible until each fight starts; re-verify before event.
- Fight cutoff rule: stop all test actions for a fight at its verified actual start time.

## Fight cutoff status and results (live check 2026-10-24 12:30 CST, source: Wikipedia UFC 333 results table)

Status: 9 of 14 fights complete. All early prelims and prelims done; main-card opener (Pico vs. Keita) done. Top four main-card bouts ongoing — cutoff rule: all test actions stopped for these.

Card changes verified: none affecting our card (Keita-for-Allen replacement already reflected; Caliari missed weight, bout proceeded at catchweight 120.5 lb with 30% fine to Lucindo).

### Results so far
| Bout | Winner | Method |
|---|---|---|
| Aaron Pico vs. Losene Keita (main opener) | Pico | TKO (punches) R1 1:14 |
| Reyes vs. Murzakanov | Reyes | TKO (head kick + punches) R1 2:40 |
| Yakhyaev vs. Krylov | Yakhyaev | TKO (knee + punches) R1 2:38 |
| Magomedov vs. Rowston | Magomedov | Tech. submission (guillotine) R1 1:44 |
| Dawson vs. Aliev | Dawson | UD (29-27 ×3; Aliev deducted a point R1) |
| Thicknesse vs. Chopurov | Thicknesse | Split decision (28-29, 29-28, 29-28) |
| Vagaev vs. Malkoun | Vagaev | UD (29-28 ×3) |
| Santos vs. Oki | Santos | UD (29-28 ×3) |
| Steele vs. Gugnon | Steele | KO (punches) R1 3:54 |
| Lucindo vs. Caliari (catchweight) | Lucindo | UD (30-27 ×3) |

### Final results — main card (all final, supplied by Daniel 15:26 CST)

| Bout | Winner | Result | Records |
|---|---|---|---|
| Volkanovski vs. Evloev (FW main event) | **Alexander Volkanovski** | KO/TKO R2 4:54 | 29-4-0 / 20-1-0 |
| Yan vs. Dvalishvili (BW co-main) | **Petr Yan** | Decision R5 | 21-5-0 / 21-6-0 |
| Kavanagh vs. Temirov (Flyweight) | **Lone'er Kavanagh** | KO/TKO R1 4:28 | 11-2-0 / 20-4-0 |
| Volkov vs. Kuniev (Heavyweight) | **Alexander Volkov** | Decision R3 | 41-11-0 / 14-4-1 (1 NC) |
| Pico vs. Keita (Featherweight) | **Aaron Pico** | KO/TKO R1 1:14 | 15-5-0 / 17-3-0 |

Prelims and early prelims: results not supplied in the 15:26 list; the earlier
live-fight table above records what was observed during monitoring.

**Completion verification (17:15 CST run):** event confirmed complete — all 14 bouts finished. Final results recorded above; provenance warning stands (not independently verified against an official UFC source). Settlement of test bets HELD per Daniel's instruction; winner banner and `settleBet` remain unverified.

**Provenance warning:** these results came from a pasted summary whose own footer
states the winners were inferred from supplied data and should be verified
against an official UFC source before publishing. No independent verification was
performed. Settlement decisions must account for this.

## T15 verification (2026-10-24 12:30 CST)
- Production frontend `/bet` now returns 200 on web.app (was 404 at A012) — frontend was redeployed; page renders "Apuestas Disponibles" with the UFC 333 bet card visible.
- `getAllBets` returns 200; the UFC 333 main-event bet is still listed and open.
- Finding: the app has **no bet close/cutoff behavior** — bets remain open after a fight's actual start time. No code path for closing bets found in the source (no cutoff/deadline logic; admin-side only has modal close handlers). T15 = NOT SUPPORTED (documented defect/feature gap for the final report). Mitigation: stop placing test bets once fights start (done).