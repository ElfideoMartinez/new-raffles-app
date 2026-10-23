# Payment processor alternatives — research (Mexico)

**Research date:** 2026-10-22. **Scope:** Mexico merchant, es-MX customers, MXN sales of raffle tickets and sports-bet tickets; no currently working card processor after Stripe removal. This is processor research, not legal advice or a provider eligibility decision. Fees, methods, underwriting and payout terms change; confirm directly in writing before integration.

## 1. Requirements recap

- Accept MXN cards and locally expected cash/transfer methods: OXXO voucher and SPEI where available.
- Settle funds to the operator’s Mexican bank account; establish actual availability/hold/reserve/withdrawal timing during onboarding.
- Prefer transaction-based pricing (no required recurring platform fee), with fixed fee and IVA clearly accounted for.
- Small-team API fit: stable server APIs/SDKs, test environment, clear payment state model, idempotency, reliable signed webhooks, and support that can answer underwriting questions.
- **Critical eligibility gate:** provider must expressly approve the actual product: paid raffle/pool entries and sports betting tickets in Mexico. Raffles may legally be treated as gambling/lottery even if called a raffle or pool. Do not disguise the activity or run payments before written approval. Provider terms can prohibit gambling regardless of local legality; approval can be withdrawn and funds held.

## 2. Comparison

| Provider | MXN support | Card + cash channels (OXXO/SPEI) | Published fee basis (transaction pricing) | Settlement time | Checkout/API fit | Webhooks | Docs | Gambling / raffle acceptability | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Mercado Pago** | Yes | Cards; OXXO cash in checkout offerings; SPEI availability depends on product/account—verify enabled methods | Checkout and Link have separate schedules; public pages show 3.49% for immediate checkout (IVA treatment shown separately) and Link rates vary by release speed/payment type | Varies by product and selected release schedule; checkout page advertises immediate availability | Good: Checkout Pro (redirect) and API options; convenient for Firebase server-side order/preference creation | Payment notifications via webhooks, signature/authentication available | Good, localized developer docs | **Unconfirmed / high risk.** Terms have prohibited activities policies; no safe inference that paid raffle/betting is approved. Obtain written approval | Easiest practical shortlist candidate if account underwriting accepts the exact model; verify SPEI and actual checkout product method list |
| **Conekta** | Yes | Cards, OXXO/cash and SPEI documented | Published pricing: OXXO/cash 2.6% + MXN$3 + IVA (general profile); SPEI MXN$12.50 + IVA per successful transfer; card price varies/profile-specific and must be confirmed | Contract/profile dependent; public site/docs do not settle a universal timeline | Strong local API/payment method coverage; Node integration plausibly suitable | Webhooks/event notifications supported; verify signature/retry/idempotency behavior for chosen product | Good Spanish docs | **Unconfirmed / high risk.** Public prohibited-business policy/profile review; exact gambling/raffle ruling not established here | Strong OXXO/SPEI alternative; ask compliance about both raffle and sports pools before onboarding |
| **Clip** | Yes | Online checkout/card; no verified OXXO/SPEI API coverage in reviewed official material | Online checkout stated 3.6% + IVA per successful sale; no recurring fee advertised | Public product description indicates deposits, but exact settlement SLA should be confirmed | Digital checkout offering; public integration/API detail appears less comprehensive than MP/Conekta; verify backend API access | Not sufficiently verified for production-grade server integration | Consumer/seller docs; developer coverage less clear | **Unconfirmed / high risk.** No affirmative permission for gambling found | Useful for simpler checkout, but gaps on cash methods and API/webhook fit make it weaker for this app |
| **Openpay (BBVA)** | Yes | Cards and SPEI; cash via Paynet noted, but OXXO-specific availability/fee is uncertain | Public page lists cards from 2.9% + MXN$2.50 + IVA; SPEI MXN$8 + IVA; cash conditions may vary | Contract/account dependent; confirm payout SLA/holds | Mature API and payment methods; likely workable with Firebase server calls | API supports notifications; verify signing/auth and retry specifics | Good technical docs | **Unconfirmed / high risk.** Public evidence reviewed does not establish permission; acquiring partner rules apply | Attractive card/SPEI pricing; do not assume Paynet means direct OXXO support—verify exact voucher network and terms |
| **Stripe Mexico** (reference) | Yes | Cards; OXXO documented in MXN; SPEI coverage not confirmed in reviewed official material | Domestic card: 3.6% + MXN$3; international card and conversion add fees; OXXO fee must be checked on current local-method pricing | Standard payout schedule/account-specific; first payout/holds can differ | Excellent API/SDKs and Firebase server use | Strong signed webhook model and tooling | Excellent | **High risk / possibly ineligible**: not proven accepted for paid gambling/raffles. Existing card processing was removed, but this research did not inspect account-specific removal details. A new account should not be presumed viable | Keep only as reference; ask Stripe for written business-type eligibility before considering any new account/application |
| **PayPal Braintree** | Currency support yes; MX merchant acceptance/settlement configuration requires confirmation | Cards in MXN; OXXO is currently limited-release/pilot-only in Mexico; SPEI not verified | No reliable Mexico-specific Braintree merchant price confirmed in reviewed public sources; obtain quote | Merchant account/currency configuration dependent | Strong API/SDK capability, but account setup/market and payment-method availability add friction | OXXO requires webhook integration; details are documented | Good technical docs | **High risk / likely problematic:** PayPal APM terms explicitly prohibit gambling of any kind; confirm which terms govern Braintree product and raffle classification | OXXO pilot restriction makes it a poor primary choice absent explicit invitation and compliance approval |
| **Adyen** (global option) | Mexico processing and MXN local methods documented; merchant onboarding/settlement eligibility must be confirmed | OXXO and SPEI listed in Mexico coverage material; method and account availability subject to onboarding | Pricing page lists OXXO at US$0.13 + 4%; SPEI price not verified here; Adyen pricing is method/contract dependent | Contract-specific | Excellent API/platform capabilities, but likely higher onboarding/integration overhead for a small team | Robust notifications/webhooks documented | Excellent technical documentation | **Unconfirmed / high risk.** No Mexico-specific written approval for raffles/betting established | Strong global platform but may be overkill; acquire direct written gambling approval and complete commercial quote first |

## 3. Provider notes and source links

### Mercado Pago
Its Mexico checkout page describes cards and OXXO availability and publishes checkout pricing (including an immediate availability option); Link de Pago has separate rates and timing. [Checkout and pricing](https://www.mercadopago.com.mx/herramientas-para-vender/check-out) · [Link de Pago rates](https://www.mercadopago.com.mx/link/link-de-pago) · [developer payment notifications](https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/payment-notifications). API docs use payment/order flows; determine OXXO/SPEI methods from the account/country method list rather than assuming every product supports them. [Checkout API payment integration](https://www.mercadopago.com.mx/developers/en/docs/checkout-api-orders/payment-integration). Terms include a prohibited-activities policy; exact status of paid raffles and sports pools remains **uncertain** until their compliance team approves in writing. [Prohibited activities](https://www.mercadopago.com.mx/ayuda/18572).

### Conekta
Public pricing states OXXO/cash at 2.6% + MXN$3 + IVA for general business profiles and SPEI at MXN$12.50 + IVA per successful transfer; card fees and any profile-specific rates need confirmation. [Pricing](https://www.conekta.com/pricing) · [SPEI/bank transfers](https://www.conekta.com/payments/bank-transfers). API/product docs cover online payments and webhooks; exact settlement schedule and gambling decision are **uncertain** from public materials. [Developer docs](https://developers.conekta.com/) · [business profiles / terms](https://www.conekta.com/legal/business-profiles).

### Clip
Clip publishes online checkout pricing of 3.6% + IVA per successful transaction. [Online payments](https://www.clip.mx/soluciones/pagos-online-clip) · [Checkout](https://www.clip.mx/soluciones/checkout). I could not verify API-enabled OXXO/SPEI, a sufficiently detailed webhook contract, or a public gambling acceptance rule from the official material reviewed; treat each as **uncertain**, not as supported/allowed.

### Openpay (BBVA)
Openpay’s official rates list cards from 2.9% + MXN$2.50 + IVA and SPEI at MXN$8 + IVA. Its materials describe cash/Paynet but the exact OXXO route and merchant fee are **uncertain** and need written confirmation. [Fees](https://www.openpay.mx/comisiones/) · [API docs](https://documents.openpay.mx/docs/api). Raffle/betting acceptance and settlement timing are also **uncertain**; ask Openpay/BBVA compliance and identify the actual acquiring/payment partner constraints.

### Stripe Mexico
Stripe’s Mexico pricing page lists domestic cards at 3.6% + MXN$3 (with added fees for international cards/currency conversion). [Mexico pricing](https://stripe.com/mx/pricing) · [local methods pricing](https://stripe.com/mx/pricing/local-payment-methods) · [OXXO integration](https://docs.stripe.com/payments/oxxo/accept-a-payment?locale=es-419). Stripe offers strong APIs/webhooks, but the reason for the prior account/card removal is unknown here; do not assume applying again will work. Gambling/raffle permission and new-account viability are **unconfirmed**; first request a written review from Stripe.

### PayPal Braintree
Braintree lists MXN among supported currencies; its OXXO guide says Mexico OXXO is limited-release/pilot-only, requiring MXN and webhooks. [Currencies](https://developer.paypal.com/braintree/docs/reference/general/currencies) · [OXXO guide](https://developer.paypal.com/braintree/docs/guides/local-payment-methods/oxxo) · [expanded eligibility](https://developer.paypal.com/expanded/eligibility). No dependable Mexico Braintree processing-fee figure was located, so none is asserted; obtain an account-specific quote. PayPal’s Mexico alternative-payment terms expressly prohibit “gambling of any kind”; applicability to the specific Braintree agreement/product and whether raffle tickets count should be confirmed in writing. [Mexico APM terms PDF](https://www.paypalobjects.com/marketing/ua/pdf/MX/en/apm-tnc.pdf?locale.x=en_MX).

### Adyen
Adyen documents Mexico OXXO (MXN voucher payment) and its pricing page shows OXXO at US$0.13 + 4%; SPEI availability is described for Mexico but a public SPEI fee was not confirmed. [OXXO](https://docs.adyen.com/payment-methods/oxxo/) · [Mexico payment methods](https://www.adyen.com/payment-methods-guides/latin-america/mexico) · [pricing](https://www.adyen.com/pricing). Merchant fit, settlement cadence and gambling acceptance depend on underwriting/contract and remain **uncertain**; Adyen may be operationally heavyweight for this small-team app.

## 4. Recommendation shortlist

1. **Mercado Pago Checkout Pro (first investigation), conditional on written approval.** Best practical first test for a small Mexico-focused app: MXN checkout, local OXXO support, localized docs, and webhook flow fit Firebase Functions. Tradeoff: paid raffle/pool betting eligibility is unresolved and may be prohibited; also verify SPEI and exact cash method availability under the chosen checkout product/account.
2. **Conekta (parallel underwriting inquiry).** Stronger explicit OXXO + SPEI coverage and clearly published transaction fees; API-first local provider is a good match. Tradeoff: gambling/raffle permission and exact card pricing/settlement are not established publicly, so written compliance approval is a hard gate.

**Fallback only:** Openpay if OXXO/Paynet details and gaming eligibility are confirmed. Do not choose any provider solely based on price before its written underwriting decision; **none of the reviewed options is confirmed as accepting this exact business model**.

## 5. Implementation sketch for #1 (Mercado Pago), conditional on approval

Use a server-side Firebase HTTPS/callable function for checkout creation and an HTTPS webhook endpoint for payment state. Exact SDK/API should follow the currently supported Mercado Pago product (Checkout Pro preference vs current Checkout API order) and method availability of the approved account.

```text
client -> createCheckout({raffleId, ticketSelection})
  function: authenticate user; validate raffle is open and capacity exists
  function: load authoritative ticket prices/IDs from Firestore
  function: calculate total in integer centavos; never accept client total
  function: create pending order/hold with server-generated orderId + expiry
  function: create Mercado Pago checkout preference/order (MXN)
      external_reference = orderId; notification_url = HTTPS webhook
      metadata = opaque orderId only; server sets line-items and amounts
  function: persist provider payment/order id; return only checkout URL

Mercado Pago -> webhook POST
  verify provider signature using secret and documented canonical signing rules
  acknowledge quickly; fetch payment/order from provider API (do not trust body alone)
  check provider account, currency=MXN, exact amount, external_reference/orderId,
       final paid status, and expected merchant/payment method
  transactionally deduplicate provider event/payment ID
  if paid and order still eligible: server writes sale/ticket ownership,
       provider ids, verified=true, and paidAt; release reservation safely
  if pending/failed/expired/refunded: update server-owned payment state only

client: reads server-written sale/status; cannot write total, payment status,
        ticket allocation, or verified=true
```

Use event idempotency and provider API retrieval to handle retries/races. Ensure Firestore rules block client writes to authoritative sale/payment fields. If OXXO/SPEI is asynchronous, reserve inventory only with an expiry and reconcile late/duplicate payments; payment approval from a browser redirect is never proof of payment. Mercado Pago webhook docs describe payment notifications and signature validation: [Checkout Pro notifications](https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/payment-notifications) · [webhook signature/notifications](https://www.mercadopago.com.mx/developers/en/docs/checkout-api-payments/additional-content/your-integrations/notifications/webhooks).

## 6. Open questions for Daniel

1. What is the operator’s legal entity type and country of registration (individual/Persona Física, Mexican entity, or other), and does it hold any required Mexican gaming/raffle permits?
2. What are expected monthly MXN gross volume, average ticket amount, and transaction mix (card vs OXXO vs SPEI)? These affect underwriting, reserves and fee comparison.
3. Are payouts to the operator’s bank account manual withdrawals or scheduled/automatic settlement? Which Mexican bank account name/entity must match the merchant account?
4. Is each offering a paid raffle, pool betting entry, sports-betting wager, or free-entry promotional sweepstakes? Please distinguish the legal/product mechanics; provider underwriting hinges on this.
5. Can the business pause sales until a provider grants explicit written approval for the exact activities and territories?
