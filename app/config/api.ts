// Central API endpoint configuration.
//
// WHY THIS EXISTS
// Before this file, 18 Cloud Function URLs were hardcoded inline across 10
// files, plus a second function host (createquickticket-*) in quickTicket/play.
// That made the app untestable against the emulator, undeployable to a second
// environment, and painful to rename a function in.
//
// RULE: no file may build a functions URL by hand. Import `apiUrl` instead.
//
// ENV VARS (all optional in development, required in production):
//   NEXT_PUBLIC_API_BASE_URL              e.g. http://127.0.0.1:5001/raffleapp-dbc1b/us-central1
//   NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL  same shape; fallback for older env files
//   NEXT_PUBLIC_BASE_URL                  the site origin, e.g. https://raffleapp-dbc1b.web.app
//
// Resolution order:
//   1. NEXT_PUBLIC_API_BASE_URL
//   2. NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL
//   3. hardcoded production default (keeps the current deployment working
//      even if env vars are missing, which is the current reality)

const PROD_FUNCTIONS_BASE =
  "https://us-central1-raffleapp-dbc1b.cloudfunctions.net";

// The quick-ticket function lives on a different host (deployed separately
// with its own generated run.app URL). Kept as a named constant so it is
// visible rather than buried in a template literal.
const PROD_QUICK_TICKET_BASE =
  "https://createquickticket-3ve3qo4dga-uc.a.run.app";

export const functionsBaseUrl: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL ||
  PROD_FUNCTIONS_BASE;

export const quickTicketBaseUrl: string =
  process.env.NEXT_PUBLIC_QUICK_TICKET_BASE_URL || PROD_QUICK_TICKET_BASE;

export const siteBaseUrl: string =
  process.env.NEXT_PUBLIC_BASE_URL || "";

/**
 * Build a Cloud Functions URL by function name.
 *
 *   apiUrl("getAllRaffles") -> `${base}/getAllRaffles`
 */
export function apiUrl(fnName: string): string {
  return `${functionsBaseUrl.replace(/\/+$/, "")}/${fnName.replace(/^\/+/, "")}`;
}

/** Build a quick-ticket function URL. */
export function quickTicketUrl(path = ""): string {
  const base = quickTicketBaseUrl.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");
  return suffix ? `${base}/${suffix}` : base;
}
