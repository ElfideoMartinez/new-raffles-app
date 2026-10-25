# Instagram publishing options — UFC 333 promotion workstream

Date: 2026-10-23 (research run 18:35–18:45 CST). Event: **UFC 333 Volkanovski vs. Evloev, 2026-10-24** — early prelims 08:00, prelims 10:00, main card 12:00 (CST, per `event-card.md`).
Scope: research + decision brief only. **No accounts created, nothing published, no credentials touched.** Sources: public docs read 2026-10-23 unless noted.

---

## 1. Route (a): Business/Meta API publishing — step-by-step requirements

What it takes to publish via the official Instagram Platform API without any existing token:

1. **Instagram professional account.** Convert the (to-be-created) Instagram account to Business (or Creator). Personal accounts are not supported by the publishing API. Sources: Meta Instagram Platform overview (https://developers.facebook.com/docs/instagram-platform/overview); 2023-06-12 Meta blog extending publishing to Creator accounts (https://developers.facebook.com/blog/post/2023/06/12/introducing-new-features-and-expanded-user-types-to-the-instagram-content-publishing-api/).
2. **Facebook Page link.** The professional IG account must be linked to a Facebook Page (required for the Facebook-Login path and Business Suite integration). Same overview doc.
3. **Meta developer account + app.** Create an app at developers.facebook.com, add the Instagram product. For the newer "Instagram API with Instagram Login" flow the required permissions are `instagram_business_basic` + `instagram_business_content_publish`; the older Facebook-Login flow uses `instagram_content_publish` (Business-only historically; Creator added 2023). Sources: media_publish reference (https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish); create-a-meta-app doc (https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram).
4. **Token.** Generate a user access token via the login flow (Graph API Explorer / Business Login for Instagram), then exchange for a long-lived token. The token holder must be the account owner (Daniel).
5. **Meta App Review.** Advanced Access to publishing permissions **requires App Review** — official, non-negotiable (overview doc; media_publish doc). In-development/test mode only reaches app-role accounts, which is fine for Daniel's own account (he'd be a test/app-role user), so first posts can technically happen before review — **uncertainty: this dev-mode path for one's own account is commonly reported but Meta's docs on it are thin; treat as unverified.**
6. **Publishing constraints (API):** two-step flow (create media container → `media_publish`); no text-only posts; images must be publicly fetchable URLs meeting format specs; 50 API-published posts per 24h per account; **Stories are publishable only via the newer Instagram API with Instagram Login (and with content publish for stories), not the legacy Graph flow — uncertainty: story support parity between the two login flows is changing; verify at build time.** Sources: media_publish doc; postproxy.dev API specs blog (https://postproxy.dev/blog/social-media-platform-api-rules-rate-limits-media-specs/, accessed 2026-10-23).

**Review/approval reality for a small one-person account:** Meta publishes no guaranteed SLA. Practitioner-reported timelines: best case ~2–7 business days; common 1–3 weeks; with resubmissions 2–6 weeks; conservative total (incl. any business verification) 4–8 weeks. Sources: bundle.social "Meta app review 20 days" (https://bundle.social/blog/meta-app-review-20-days); postgate.studio guide (https://postgate.studio/blog/meta-app-review-instagram); r/facebook community guide (https://www.reddit.com/r/facebook/comments/1rux37s/a_guide_to_getting_through_meta_app_review_common/) — all accessed 2026-10-23. **Uncertainty: these are third-party reports, not Meta policy.**

**Verdict for this event:** route (a) **cannot deliver for 2026-10-24.** Even the best case exceeds the ~18 hours remaining, and route (a) also requires the account to already exist (account creation itself is manual per HANDOFF).

## 2. Realistic alternatives

| Option | What it is | Time to value | Cost | Risks/caveats |
|---|---|---|---|---|
| **Manual posting** | Assistant builds content pack; Daniel posts in-app at scheduled times | Tonight | $0, ~30–60 min Daniel tomorrow | Human must be present at each slot; no automation |
| **Meta Business Suite scheduling** (mobile/desktop) | Official free scheduler; schedule posts/reels (and some story types) for an IG professional account connected to MBS. Mobile flow: Content → Posts/Reels/Stories → Create → media+caption → Next → *Schedule for later* → time | Same-day (minutes once account exists) | Free | Requires IG→MBS connection (prof. account + Page); stories scheduling is limited/absent on some account types — **uncertainty: story scheduling support varies by account/region; posts/reels reliable**. Sources: Meta help (https://www.facebook.com/business/help/609176706604372; https://www.facebook.com/business/help/942827662903020/), accessed 2026-10-23 |
| **Creator Studio** | Legacy Meta desktop scheduling; largely superseded by MBS | Same-day | Free | Being deprecated; MBS preferred — **uncertainty: current availability for IG is shrinking** |
| **Third-party schedulers** (Buffer, Later, Metricool, etc.) | Official IG partners using the same Graph publishing API (so they still require a professional account + app-authorized token) | Same-day signup; some need IG "allow access" | ~$0–30/mo tiers | Same professional-account prerequisite as route (a); direct-story publishing is restricted for most; unofficial/free "posters" that don't use the official API are ToS-violating and risk restrictions/bans (IG Terms prohibit accessing private APIs; unauthorized automation → blocks). Sources: IG terms (https://www.instagram.com/legal/terms/); developers.facebook.com/docs/instagram-platform/overview, accessed 2026-10-23 |

**Ban-risk note:** automation outside the official API (bots, unofficial scrapers-as-posters, credential-based automation) violates Instagram's Terms and can trigger temporary blocks or permanent bans. Personal accounts have no sanctioned API at all.

## 3. Recommendation (one-person raffle op, event in ~18 h)

**Choose route (b) manual content pack, amplified by Meta Business Suite scheduling.**

Reasoning:
- **Time:** route (a) needs app creation + token + review — 2 days at absolute best, realistically 1–3+ weeks; the event is tomorrow morning. Route (b) is executable tonight.
- **Cost:** route (b) = $0 and ~1–2 h of my work building the pack + ~45 min of Daniel's time tomorrow (or 15 min if he pre-schedules posts in MBS). Route (a) = free but multi-day, plus ongoing token maintenance.
- **Risk:** route (b) has zero ToS/account risk. Route (a) later carries review friction; third-party unofficial tools carry account-ban risk — rejected.
- **Future:** route (a) remains the right investment *after* the event for hands-off scheduling; the content-pack formats below are API-compatible, so nothing is wasted.

Suggested split tomorrow: pre-build everything tonight; Daniel schedules the 08:00/10:00/12:00 feed posts in Meta Business Suite tonight or in the morning (15 min), and posts the two **stories manually at 07:30 and 12:00** (stories don't schedule reliably in MBS — see uncertainty above).

## 4. Publication plan skeleton — manual route (all times CST, 2026-10-24)

All captions in Spanish (tú). Placeholder tokens: `{LINK}` = raffles page URL, `{EVENT}` = "UFC 333: Volkanovski vs. Evloev".

### P1 — 07:30 Countdown story
- **Format:** story (1 frame, optional countdown sticker)
- **Asset:** 1080×1920 vertical card, dark theme, event logo + "HOY" + fight-night times (08:00 prelims / 12:00 estelar) + `{LINK}` link sticker to the raffles page
- **Caption/sticker text:** "🔥 HOY es el día: {EVENT}. Los boletos de la rifa siguen abiertos — toca el enlace y asegura los tuyos antes de que empiecen las peleas. 🥊 #UFC333 #Rifa"

### P2 — 08:00 Card graphic (early prelims)
- **Format:** feed post (carousel: 1 card graphic + 1 "how to participate" slide)
- **Asset:** 1080×1350 card graphic listing the fights (from `event-card.md`, verified); slide 2: 3 steps — 1) elige tu boleto 2) transfiere 3) sube tu comprobante
- **Caption:** "🥊 Arrancan las preliminares de {EVENT}. La cartelera está confirmada — y tú puedes estar en la pelea con tu boleto de la rifa. 🎟️ Participa en {LINK} (link también en bio). ¡Entre más boletos, más probabilidad de ganar! #UFC333 #Rifa"

### P3 — 10:00 "Place your bets" post (prelims)
- **Format:** feed post (single graphic or reel ≤15 s if footage available)
- **Asset:** 1080×1350 graphic "¿Quién gana?" with the two headliners; CTA band with the link
- **Caption:** "⏰ Ya van las preliminares. La pelea estelar empieza a las 12:00 — ¿quién gana: Volkanovski 🦅 o Evloev? 💥 Última llamada para tu boleto: {LINK}. Gana con la rifa y vive la velada como se debe. #UFC333"

### P4 — 12:00 Main-card hype + poll story
- **Format:** two items: (a) feed post hype graphic, (b) story with poll sticker ("¿Volkanovski o Evloev?") + link sticker
- **Asset:** 1080×1350 hype graphic "EMPIEZA EL ESTELAR"; story 1080×1920 with poll
- **Caption (feed):** "🔴 COMIENZA LA ESTELAR: {EVENT}. Mientras definen al ganador, la rifa sigue en pie — el ganador se anuncia esta tarde en esta cuenta. 🏆 Boletos: {LINK} #UFC333"
- **Story poll sticker:** "¿Quién gana?" options: "Volkanovski 🇦🇺" / "Evloev 🇷🇺" (flag emojis — **uncertainty: verify fighters' represented flags in event-card.md before posting**)

### P5 — Results template (post-event, target 17:30–18:00)
- **Format:** feed post + reshare to story
- **Asset:** winner-announcement template (leave winner name/payout fields blank until results verified)
- **Caption (template):** "🏆 Resultado oficial de {EVENT}: {GANADOR} ganó por {MÉTODO} en el round {R}. Y el ganador de nuestra rifa es… ¡{FELICITADO}! 🎉 Gracias a todos los que participaron — nos vemos en la próxima pelea. Sigue esta cuenta para la próxima rifa. #UFC333 #Rifa"
- **Gate:** fill placeholders only from verified results (post-decision, main-card completion); align with the 17:30 completion automation.

## 5. Anything API MCP — Instagram Comments Scraper (read-only confirmation)

- Endpoint: `https://anything.notte.cc/mcp`; function `8487d353-6cfe-416e-a14e-659c14924eee` ("Instagram Comments Scraper", input `post_url`).
- **Confirmed read-only in nature:** the Anything API tools are `search`/`spec` (public), and `run`/`build`/`publish` (signed in). `run` executes an API and returns JSON — a comments scraper returns comment data only; it is not a publishing tool. Source: Anything API MCP docs (https://anything.notte.cc/docs/mcp-server, fetched 2026-10-24T00:36Z).
- **Auth:** browsing (`search`/`spec`) is public; `run` requires a credential — either OAuth sign-in via the AI client or a **Notte bearer token** (API key created in the Notte console). This matches HANDOFF's observed 401 before credentials. Sources: anything.notte.cc docs (above); docs.notte.cc/mcp-server and docs.notte.cc/api-reference/authentication (accessed 2026-10-23).
- **Not attempted:** no credentials used or stored, per task scope. If Daniel supplies a Notte API key later (secrets vault, not chat), comment retrieval on our own posts can be tested read-only.

## 6. Uncertainties (labeled)

- App-review timelines are third-party-reported, not official Meta SLAs.
- Story scheduling support in Meta Business Suite varies by account type/region; story *publishing via API* support differs between the legacy Graph flow and the newer Instagram-Login flow — verify at build time against current docs.
- Dev-mode posting to one's own account without full review is commonly reported but under-documented by Meta.
- Fighter flags/aliases for the poll sticker must be verified against `event-card.md` before publishing.

## Sources (all accessed 2026-10-23 unless noted)

1. https://developers.facebook.com/docs/instagram-platform/overview — Instagram Platform overview (professional account requirement, app review)
2. https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish — publishing flow & constraints
3. https://developers.facebook.com/blog/post/2023/06/12/introducing-new-features-and-expanded-user-types-to-the-instagram-content-publishing-api/ — Creator accounts added
4. https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/create-a-meta-app-with-instagram — app/permission setup
5. https://www.facebook.com/business/help/609176706604372 and https://www.facebook.com/business/help/942827662903020/ — Meta Business Suite mobile scheduling
6. https://www.instagram.com/legal/terms/ — IG Terms (private-API prohibition, enforcement)
7. https://bundle.social/blog/meta-app-review-20-days ; https://postgate.studio/blog/meta-app-review-instagram ; https://www.reddit.com/r/facebook/comments/1rux37s/ — practitioner review-timeline reports
8. https://anything.notte.cc/docs/mcp-server (fetched 2026-10-24T00:36Z) ; https://docs.notte.cc/mcp-server ; https://docs.notte.cc/api-reference/authentication — Anything API auth model

## 7. Antwork integration (added 2026-10-24 12:30 CST — ACTIVE)

- **Decision change:** Instagram publishing now runs through **Antwork** (`https://api.antwork.io/mcp`), registered as MCP server `antwork` (streamable-http + OAuth, authorized 2026-10-24 ~10:00 CST, 22 tools). Route (b) "manual" is superseded for *feed posts*; stories still go out manually from the phone (Antwork supports IG stories via `publishType: story`, but treat that as untested — feed post is the default).
- **Account:** IG `@elfideomartinez` (id `083Zc9h9ETCBnUQbZC84`), workspace `elfideomartinez` (`tUp47gQT6TMIUL6JZYnK`), plan free (50 posts/24h cap, token healthy). Owner: Daniel Martínez <fideomartinez52@gmail.com>.
- **Media rules:** Instagram requires ≥1 image/video per post; images must be .jpg/.jpeg ≤8 MB (PNG converted with `sips -s format jpeg`). Upload flow: `add_media({upload:{}, attach_to_post_ids:[...]})` → one-time PUT URL → curl.
- **Flow used:** `create_post` (draft) → `add_media` → `schedule_post`. Approval gate: Daniel approves copy before scheduling; a cancel window is stated after scheduling.
- **Account change (12:41 CST):** Daniel un-programmed the first schedule and added the brand account **@bet.mx.ufc** (id `gUi1o3IWQLG6ws6vHnYi`). Personal @elfideomartinez must NOT be used for raffle posts. P3 draft `a130f6ae91c3ee311937` retargeted to @bet.mx.ufc and re-scheduled 2026-10-24 12:55 CST — caption has the real URL https://raffleapp-dbc1b.web.app (Daniel: no @link-in-bio, URL in caption).
- **Remaining today:** P4 12:00 story (manual from phone, graphic `p4-story-hype.png`); optional P4 feed post via Antwork with `hype-maincard` asset; P5 results template ~17:30–18:00 via Antwork after verified results.
- **Uncertainty:** Antwork's "best times" are network averages and do not fit live-event timing — event-driven schedule wins.
