import * as functionsV1 from "firebase-functions/v1";
import * as functions from "firebase-functions";
import crypto from "crypto";
import * as admin from "firebase-admin";
import { getDatabase } from "firebase-admin/database";
import { getRemoteConfig } from "firebase-admin/remote-config";
import type express from "express";
import { buildNotificationPayload, tokensByUser } from "./notifications";
import {
  DEFAULT_TAKE_RATE,
  distributableCents,
  payoutPerTicketCents,
  poolCents,
  sanitizeTakeRate,
  toCents,
} from "./payout";

admin.initializeApp();
const db = admin.firestore();
const rtdb = getDatabase();
const remoteConfig = getRemoteConfig();

// ---------------------------------------------------------------------------
// Admin authorization
// ---------------------------------------------------------------------------
// Admin-only endpoints are plain HTTPS functions, so they are callable by
// anyone who knows the URL. Every mutating/admin endpoint must therefore start
// with `assertAdmin(authHeader)`.
//
// The identity is the Firebase ID token sent as `Authorization: Bearer <idToken>`
// by the admin UI (see app/config/api.ts, authedApiFetch). The token must carry
// the custom claim `admin === true`.
//
// OPERATIONAL NOTE: `firebase-functions` does not support adding secrets to an
// already-deployed HTTP trigger in place. The first deploy after this change
// may report a conflict for each affected function; see SECURITY-ROTATION.md
// for the one-time remediation.
async function assertAdmin(
  authorizationHeader: string | undefined
): Promise<void> {
  const header = authorizationHeader || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Sign in as an administrator to use this endpoint."
    );
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Invalid or expired session."
    );
  }

  if (decoded.admin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Administrator privileges are required."
    );
  }
}

/** Append an audit entry for a successful admin mutation (best effort). */
async function logAdminAction(
  authorizationHeader: string | undefined,
  action: string,
  detail: unknown
): Promise<void> {
  try {
    const header = authorizationHeader || "";
    const token = header.split(" ")[1];
    const decoded = token ? await admin.auth().verifyIdToken(token) : null;
    await db.collection("adminWriteLog").add({
      uid: decoded ? decoded.uid : null,
      action,
      detail: JSON.parse(JSON.stringify(detail ?? {})),
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("adminWriteLog failed:", action, err);
  }
}

/**
 * Set the CORS headers every HTTP function needs, and answer preflights.
 *
 * MUST run before any auth check. Auth rejections are 401/403 responses; if
 * the CORS headers are not already on the response the browser hides the real
 * status behind an opaque "CORS error" (that is exactly what made the admin
 * sales page look like an empty list instead of "session expired").
 *
 * Returns true when the request was a preflight and the caller must return.
 *
 * `Authorization` is allowed explicitly: admin endpoints read the Firebase ID
 * token from that header, and a preflight that does not allow it fails even
 * for a fully signed-in admin.
 */
function applyCors(
  req: functionsV1.https.Request,
  res: express.Response,
  methods: string
): boolean {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", methods);
  res.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept"
  );
  res.set("Access-Control-Max-Age", "3600");
  if (req.headers.origin) {
    res.set("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

/**
 * Diagnosable multicast outcomes (item 20, 2026-10-25): log success vs
 * unregistered vs invalid counts per send, and prune tokens FCM reports as
 * UNREGISTERED (dead device registrations) by deleting their roster docs, so
 * bulk sends stop retrying stale tokens and the client simply re-registers
 * on its next visit.
 */
async function summarizeAndPruneMulticast(
  label: string,
  tokens: string[],
  response: admin.messaging.BatchResponse
): Promise<void> {
  const unregisteredTokens: string[] = [];
  let invalid = 0;
  let other = 0;
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code ?? "unknown";
    if (code === "messaging/registration-token-not-registered") {
      if (tokens[i]) unregisteredTokens.push(tokens[i]);
    } else if (code === "messaging/invalid-argument") {
      invalid += 1;
    } else {
      other += 1;
      console.warn(`${label}: token[${i}] FCM error ${code}: ${r.error?.message}`);
    }
  });
  console.log(
    `${label}: sent=${response.successCount} failed=${response.failureCount} ` +
      `unregistered=${unregisteredTokens.length} invalid=${invalid} other=${other}`
  );
  for (const token of unregisteredTokens) {
    try {
      const stale = await db
        .collection("notificationTokens")
        .where("token", "==", token)
        .get();
      const batch = db.batch();
      stale.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      if (stale.size > 0) {
        console.log(`${label}: pruned ${stale.size} unregistered token doc(s)`);
      }
    } catch (err) {
      console.warn(`${label}: pruning stale token failed:`, err);
    }
  }
}

/**
 * Run the admin check for an HTTP request. Returns true when the request was
 * rejected and the caller must return immediately.
 *
 * CORS is applied first so the browser can read the 401/403 and show the admin
 * a real message instead of an opaque network error.
 */
async function rejectUnlessAdmin(
  req: functionsV1.https.Request,
  res: express.Response,
  methods = "GET, POST, OPTIONS"
): Promise<boolean> {
  if (applyCors(req, res, methods)) return true;
  try {
    await assertAdmin(req.headers.authorization);
    return false;
  } catch (err) {
    const denied =
      err instanceof functions.https.HttpsError &&
      err.code === "permission-denied";
    const status = denied ? 403 : 401;
    const message =
      err instanceof functions.https.HttpsError
        ? err.message
        : "Authorization failed.";
    res.status(status).json({ status, message });
    return true;
  }
}

// ADMIN-ONLY: gated behind admin auth (backlog 3). The public site does not
// call this today; any future caller must send an admin ID token via
// `authedApiFetch`.
export const sendPurchaseNotifications = functions.https.onRequest(
  async (req, res) => {
    if (await rejectUnlessAdmin(req, res, "POST, OPTIONS")) return;
    await logAdminAction(req.headers.authorization, "sendPurchaseNotifications", {
      note: "manual admin push to all registered devices",
    });
    try {
      const data = req.body;
      console.log("Data received:", data);

      // Get the FCM token from the request body
      // check notificationTokens collection in Firestore and bring all token strings in a an array
      const notificationTokensCollection = db.collection("notificationTokens");
      const tokensSnapshot = await notificationTokensCollection.get();
      const fcmTokens: string[] = [];
      tokensSnapshot.forEach((doc) => {
        const tokenData = doc.data();
        if (tokenData.token && tokenData.enabled !== false) {
          fcmTokens.push(tokenData.token);
        }
      });
      if (!fcmTokens) {
        res.status(400).json({
          status: 400,
          message: "FCM token is required",
        });
        return;
      }

      // Send the message using Firebase Cloud Messaging
      const response = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        ...buildNotificationPayload({
          title: "Nueva compra pendiente de confirmación",
          body: "Hay una compra nueva. Revisa los detalles en el panel de administración.",
          destination: "adminSales",
          imageUrl:
            "https://firebasestorage.googleapis.com/v0/b/raffleapp-dbc1b.appspot.com/o/icon.jpg?alt=media&token=3f65205e-c8aa-4918-b6ab-2ff2209ad761",
        }),
      });
      await summarizeAndPruneMulticast("sendPurchaseNotifications", fcmTokens, response);

      res.status(200).json({
        status: 200,
        message: "Notification sent successfully",
        response: {
          successCount: response.successCount,
          failureCount: response.failureCount,
          errors: response.responses
            .map((r, i) =>
              r.success
                ? null
                : { tokenIndex: i, code: r.error?.code, message: r.error?.message }
            )
            .filter(Boolean),
        },
      });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({
        status: 500,
        message: "Error sending notification",
      });
    }
  }
);

// PUBLIC: quick-ticket play page. Not part of the admin surface.
export const createQuickTicket = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(204).send({
      message: "Preflight request successful",
    });
    return;
  }
  try {
    // Handle GET: create the ticket but don't return full data
    if (req.method === "GET") {
      const ticketId = `ticket_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      const activationCode =
        //random 6 digit number
        Math.floor(100000 + Math.random() * 900000).toString();

      // Get probabilities from Remote Config
      const probabilities = await getWinnerProbabilitiesFromRemoteConfig();
      console.log("Using probabilities from Remote Config:", probabilities);

      // Determine winner level based on probabilities
      const winnerLevel = determineWinnerLevel(probabilities);
      console.log("Winner level determined:", winnerLevel);
      const symbols = getQuickTicketsSymbols(winnerLevel);

      const ticketData = {
        id: ticketId,
        status: "pending",
        symbols,
        activationCode,
        createdAt: Date.now(),
        isWinner: winnerLevel !== "none",
        winnerLevel,
      };
      //add ticket to quickTickets collection
      const itemRef = rtdb.ref(`quickTickets/${ticketId}`);
      await itemRef.set(ticketData);
      console.log("Ticket generated and saved:", ticketId);
      res.status(200).json({
        status: 200,
        message: "Ticket created",
        data: {
          id: ticketId,
          status: "pending",
          activationCode,
        },
      });
    }
  } catch (error) {
    console.error("Error creating quick ticket:", error);
    res.status(500).json({
      status: 500,
      message: "Error creating quick ticket",
      error: error || "Unknown error",
    });
  }
});

// Winner level probabilities (easily configurable)
const WINNER_PROBABILITIES = {
  bigWinner: 0.003, // 0.3% - 🏆 Big Winner (rarest)
  specialWinner: 0.005, // 0.5% - 💎 Special Winner
  regularWinner: 0.1, // 10% - ⭐️ Regular Winner
  minorWinner: 0.2, // 20% - 🎯 Minor Winner
  // Remaining 80% are non-winners
};

// Cache for Remote Config values
let cachedProbabilities: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Helper function to get probabilities from Remote Config with caching
const getWinnerProbabilitiesFromRemoteConfig = async () => {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedProbabilities && now - cacheTimestamp < CACHE_DURATION) {
      console.log("Using cached Remote Config probabilities");
      return cachedProbabilities;
    }

    console.log("Fetching fresh Remote Config probabilities");
    const template = await remoteConfig.getTemplate();
    const parameters = template.parameters;

    const probabilities = {
      bigWinner:
        parameters.bigWinner?.defaultValue &&
        "value" in parameters.bigWinner.defaultValue
          ? parseFloat(parameters.bigWinner.defaultValue.value)
          : WINNER_PROBABILITIES.bigWinner,
      specialWinner:
        parameters.specialWinner?.defaultValue &&
        "value" in parameters.specialWinner.defaultValue
          ? parseFloat(parameters.specialWinner.defaultValue.value)
          : WINNER_PROBABILITIES.specialWinner,
      regularWinner:
        parameters.regularWinner?.defaultValue &&
        "value" in parameters.regularWinner.defaultValue
          ? parseFloat(parameters.regularWinner.defaultValue.value)
          : WINNER_PROBABILITIES.regularWinner,
      minorWinner:
        parameters.minorWinner?.defaultValue &&
        "value" in parameters.minorWinner.defaultValue
          ? parseFloat(parameters.minorWinner.defaultValue.value)
          : WINNER_PROBABILITIES.minorWinner,
    };

    // Update cache
    cachedProbabilities = probabilities;
    cacheTimestamp = now;

    return probabilities;
  } catch (error) {
    console.error(
      "Error fetching Remote Config probabilities, using defaults:",
      error
    );
    return WINNER_PROBABILITIES;
  }
};

type WinnerLevel =
  | "bigWinner"
  | "specialWinner"
  | "regularWinner"
  | "minorWinner"
  | "none";

const determineWinnerLevel = (
  probabilities = WINNER_PROBABILITIES
): WinnerLevel => {
  const random = crypto.randomInt(0, 1000) / 1000; // Random number between 0 and 1
  if (random < probabilities.bigWinner) {
    return "bigWinner";
  }
  if (random < probabilities.specialWinner) {
    return "specialWinner";
  }
  if (random < probabilities.regularWinner) {
    return "regularWinner";
  }
  if (random < probabilities.minorWinner) {
    return "minorWinner";
  }
  return "none"; // No winner
};

const getQuickTicketsSymbols = (winnerLevel: WinnerLevel): string[] => {
  // Define winner symbols for each level
  const winnerSymbols = {
    bigWinner: "🏆", // Big Winner
    specialWinner: "💎", // Special Winner
    regularWinner: "⭐️", // Regular Winner
    minorWinner: "🎯", // Minor Winner
  };

  // Other symbols for filling remaining slots
  const otherSymbols = [
    "🍀", // Lucky Clover
    "🎉", // Party Popper
    "💰", // Money Bag
    "🎁", // Gift
    "🥇", // Gold Medal
    "🎊", // Confetti Ball
    "🍭", // Lollipop
    "🍫", // Chocolate Bar
    "🍩", // Doughnut
    "🎈", // Balloon
    "🌈",
  ];

  if (winnerLevel === "none") {
    // Non-winner: ensure no more than 2 of any symbol in 6 slots
    const randomSymbols: string[] = [];
    const allSymbols = [...Object.values(winnerSymbols), ...otherSymbols];

    while (randomSymbols.length < 6) {
      const randomSymbol =
        allSymbols[Math.floor(Math.random() * allSymbols.length)];
      // Allow at most 2 of the same symbol for non-winners
      if (randomSymbols.filter((s) => s === randomSymbol).length < 2) {
        randomSymbols.push(randomSymbol);
      }
    }
    return randomSymbols;
  } else {
    // Winner: create pattern based on level
    const winnerSymbol = winnerSymbols[winnerLevel];
    let requiredMatches: number;

    // All winner levels require 3 matching symbols to win
    requiredMatches = 3;

    const randomSymbols: string[] = Array(requiredMatches).fill(winnerSymbol);

    // Fill remaining slots with other symbols (avoiding the winner symbol)
    while (randomSymbols.length < 6) {
      const randomSymbol =
        otherSymbols[Math.floor(Math.random() * otherSymbols.length)];
      // Don't add more winner symbols and limit other symbols to max 2
      if (
        randomSymbol !== winnerSymbol &&
        randomSymbols.filter((s) => s === randomSymbol).length < 2
      ) {
        randomSymbols.push(randomSymbol);
      }
    }

    // Shuffle the symbols to randomize their order
    return randomSymbols.sort(() => Math.random() - 0.5);
  }
};

// PUBLIC: read-only storefront data. No auth by design.
export const getRaffleData = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }
  try {
    const data = req.body;
    console.log("data", data);
    const id = data.id;

    if (!id) {
      res.status(400).json({ error: "Invalid ID provided" });
      return;
    }

    const rafflesCollection = db.collection("raffles");
    const raffleDoc = rafflesCollection.doc(id);
    const raffleSnapshot = await raffleDoc.get();

    if (!raffleSnapshot.exists) {
      res.status(404).json({ data: null });
      return;
    }

    const raffleData = raffleSnapshot.data();
    const ticketsCollection = db.collection("tickets");
    const ticketQuerySnapshot = await ticketsCollection
      .where("raffle_id", "==", id)
      .get();

    const tickets = ticketQuerySnapshot.docs.map((doc) => doc.data());
    const ticketsData = tickets.sort((a, b) => a.number - b.number);

    console.log({
      raffleData,
      ticketsData,
    });

    res.status(200).json({
      raffleData,
      data: ticketsData,
    });
  } catch (error) {
    console.error("Error fetching raffle data:", error);
    res.status(500).json({ error: "Failed to fetch raffle data" });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const markTicketsAsSold = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, OPTIONS")) return;
  if (req.method !== "POST") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    const data = req.body;
    const { raffleId, ticketNumbers } = data;

    await setTicketsAsSold(raffleId, ticketNumbers);
    await logAdminAction(req.headers.authorization, "markTicketsAsSold", {
      raffleId,
      ticketNumbers,
    });

    res.status(200).json({
      status: 200,
      message: "Tickets marked as sold",
    });
  } catch (err) {
    console.error("Error marking tickets as sold:", err);
    res.status(500).json({
      status: 500,
      message: "Error marking tickets as sold",
      error: err,
    });
  }
});

const setTicketsAsSold = async (raffleId: string, ticketNumbers: number[]) => {
  const ticketsRef = db.collection("tickets");

  for (const ticketNumber of ticketNumbers) {
    try {
      const q = ticketsRef
        .where("raffle_id", "==", raffleId)
        .where("number", "==", ticketNumber);
      const querySnapshot = await q.get();

      if (!querySnapshot.empty) {
        querySnapshot.forEach(async (doc) => {
          console.log(`Ticket found: `, doc.id, doc.data());
          await doc.ref.update({ sold: true });
        });
      } else {
        console.log(
          `No ticket found for Raffle ID: ${raffleId}, Ticket Number: ${ticketNumber}`
        );
      }
    } catch (error) {
      console.error(
        `Error fetching ticket for Raffle ID: ${raffleId}, Ticket Number: ${ticketNumber}`,
        error
      );
    }
  }
};
// ADMIN ONLY: mutates data. Requires an admin ID token.
export const createSale = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, OPTIONS")) return;
  if (req.method !== "POST") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    const data = req.body;

    // Reference to the sales collection in Firestore
    const salesCollection = db.collection("sales");

    // Add the new sale data to Firestore
    console.log("Creating sale with data:", data);
    await salesCollection.add(data);

    res.status(200).json({
      status: 200,
      message: "Sale created successfully",
    });
  } catch (err) {
    console.error("Error creating sale:", err);
    res.status(500).json({
      status: 500,
      message: "Error creating sale",
      error: err,
    });
  }
});
// ADMIN ONLY: mutates data. Requires an admin ID token.
export const success = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "POST, OPTIONS")) return;
  // CORS headers and the preflight are already handled by rejectUnlessAdmin.

  // Validate method
  if (req.method !== "POST") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    const { raffleId, ticketNumbers } = req.body;

    if (!raffleId || !ticketNumbers || !Array.isArray(ticketNumbers)) {
      res.status(400).json({
        status: 400,
        message: "Invalid request body. Expected raffleId and ticketNumbers.",
      });
      return;
    }

    // Call the function to update tickets
    await setTicketsAsSold(raffleId, ticketNumbers);

    res.status(200).json({
      status: 200,
      message: "Tickets marked as sold",
    });
  } catch (error: any) {
    console.error("Error marking tickets as sold:", error);
    res.status(500).json({
      status: 500,
      message: "Failed to mark tickets as sold",
      error: error.message,
    });
  }
});

export const getAllRaffles = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method !== "GET") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    // Get all raffles collection from Firestore
    const rafflesCollection = db.collection("raffles");
    const collectionSnapshot = await rafflesCollection.get();

    // Tickets live in the top-level `tickets` collection as one doc per
    // ticket: { number, raffle_id, sold: boolean, sold_to, verified }.
    // Remaining stock = declared numberOfTickets - docs with sold === true.
    //
    // Cost: this is deliberately an N+1 (two grouped count reads per raffle)
    // because Firestore has no GROUP BY and a single full `tickets` scan grows
    // with lifetime sales, not with live raffles. The reads run in parallel and
    // are capped at MAX_RAFFLES_WITH_STOCK so the endpoint cannot fan out
    // without bound. At current scale (a handful of live raffles) that is a
    // few count() reads per request.
    //
    // Raffles with no ticket docs (legacy/manual data) report the full
    // numberOfTickets — never 0. If the raffle doc omits numberOfTickets the
    // number of ticket docs is used as the total, and the result is clamped at
    // 0 so an inconsistent sold count cannot produce a negative.
    const MAX_RAFFLES_WITH_STOCK = 50;
    const raffleDocs = collectionSnapshot.docs.slice(0, MAX_RAFFLES_WITH_STOCK);

    const stockEntries = await Promise.all(
      raffleDocs.map(async (doc) => {
        const data = doc.data() as { numberOfTickets?: string | number };
        const declared = Number(data.numberOfTickets);
        const tickets = db.collection("tickets");
        const [allTickets, soldTickets] = await Promise.all([
          tickets.where("raffle_id", "==", doc.id).count().get(),
          tickets
            .where("raffle_id", "==", doc.id)
            .where("sold", "==", true)
            .count()
            .get(),
        ]);

        const totalDocs = allTickets.data().count;
        const sold = soldTickets.data().count;
        const total =
          Number.isFinite(declared) && declared > 0 ? declared : totalDocs;

        return [doc.id, Math.max(total - sold, 0)] as const;
      })
    );
    const ticketsLeftById = new Map(stockEntries);

    // Map the results, including the document ID
    const result = collectionSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      tickets_left: ticketsLeftById.get(doc.id),
    }));

    res.status(200).json({
      result,
    });
  } catch (err) {
    console.error("Error fetching raffles:", err);
    res.status(500).json({
      status: 500,
      message: "Error fetching raffles",
      error: err,
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const getSales = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, OPTIONS")) return;
  if (req.method === "OPTIONS") {
    // Handle preflight requests
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }
  try {
    const allSales = db.collection("sales");
    const salesSnapshot = await allSales.get();
    const sales = salesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json({
      sales,
    });
  } catch (err) {
    console.error("Error fetching sales:", err);
    res.status(500).json({
      status: 500,
      message: "Error fetching sales",
      error: err,
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const rejectSale = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, POST, OPTIONS")) return;
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    const data = req.body;
    console.log("Data from reject:", data);

    const ticketsCollection = db.collection("tickets");
    let updatePromises: Promise<FirebaseFirestore.WriteResult>[] = [];

    for (const raffle of data.raffles) {
      const ticketQuery = ticketsCollection
        .where("raffle_id", "==", raffle.raffleId)
        .where("number", "in", raffle.ticketNumbers);

      const ticketQuerySnapshot = await ticketQuery.get();

      ticketQuerySnapshot.docs.forEach((ticketDoc) => {
        console.log("Ticket:", ticketDoc.data());
      });

      updatePromises = ticketQuerySnapshot.docs.map((ticketDoc) =>
        ticketDoc.ref.update({ sold: false })
      );
    }

    const salesDocRef = db.collection("sales").doc(data.id);
    const saleUpdatePromise = salesDocRef.update({ verified: false });

    await Promise.all([...updatePromises, saleUpdatePromise]);
    await logAdminAction(req.headers.authorization, "rejectSale", { id: data.id });

    res.status(200).json({
      status: 200,
      message: "Sale rejected successfully",
    });
  } catch (err) {
    console.error("Error rejecting sale:", err);
    res.status(500).json({
      status: 500,
      message: "Error rejecting sale",
      error: err,
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const confirmSale = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, POST, OPTIONS")) return;
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    const data = req.body;
    console.log("Data:", data);

    const ticketsCollection = db.collection("tickets");
    const batch = db.batch();

    for (const raffle of data.raffles) {
      const ticketQuerySnapshot = await ticketsCollection
        .where("raffle_id", "==", raffle.raffleId) // Usar raffle.raffle_id
        .where("number", "in", raffle.ticketNumbers) // Usar raffle.ticketNumbers para los boletos de esa rifa
        .get();

      ticketQuerySnapshot.docs.forEach((ticketDoc) => {
        const ticketRef = ticketsCollection.doc(ticketDoc.id);
        batch.update(ticketRef, { sold: true });
      });
    }

    // Update sale document to mark it as verified
    const saleRef = db.collection("sales").doc(data.id);
    batch.update(saleRef, { verified: true });

    await batch.commit();
    await logAdminAction(req.headers.authorization, "confirmSale", { id: data.id });

    res.status(200).json({
      status: 200,
      message: "Sale confirmed successfully",
    });
  } catch (err) {
    console.error("Error confirming sale:", err);
    res.status(500).json({
      status: 500,
      message: "Error confirming sale",
      error: err,
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const createRaffle = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, POST, OPTIONS")) return;
  // Manejar solicitud preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).send(""); // Respuesta sin contenido para OPTIONS
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({ message: "Only POST requests are allowed" });
    return;
  }

  try {
    console.log("Processing request");
    const body = req.body;

    // Insert in "raffles" collection
    const docRef = await db.collection("raffles").add(body);

    // Generate tickets based on body.numberOfTickets
    const tickets = [];
    for (let i = 0; i < parseInt(body.numberOfTickets); i++) {
      tickets.push({
        number: i,
        raffle_id: docRef.id,
        sold: false,
        sold_to: "",
        verified: false,
      });
    }

    // Insert tickets in "tickets" collection
    const ticketsCollection = db.collection("tickets");
    const batch = db.batch();
    tickets.forEach((ticket) => {
      const ticketRef = ticketsCollection.doc();
      batch.set(ticketRef, ticket);
    });
    await batch.commit();
    await logAdminAction(req.headers.authorization, "createRaffle", {
      id: docRef.id,
      title: body.title,
      numberOfTickets: body.numberOfTickets,
    });

    res.status(200).json({
      message: "Raffle created successfully",
      body: body,
    });
  } catch (e) {
    console.error("Error creating raffle:", e);
    res.status(500).json({
      message: "An error occurred while creating the raffle",
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const checkTransfer = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, POST, OPTIONS")) return;
  // Manejar solicitud preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).send({
      message: "Preflight request successful",
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({ message: "Only POST requests are allowed" });
    return;
  }

  try {
    interface Raffle {
      raffleId: string;
      raffleName: string;
      ticketNumbers: number[];
      raffleTotalPrice: number;
    }
    let raffles: Raffle[];

    interface Bets {
      betId: string;
      betName: string;
      ticketNumbers: number;
      letterTeam: string;
      totalPrice: number;
    }
    let bets: Bets[];

    console.log("Processing sale by tranfer");
    const body = req.body;
    raffles = body.raffles;
    bets = body.bets;

    const {
      name,
      phone,
      email,
      paymentConceptKey,
      ticketCount,
      allTickets,
      totalBetsPrice,
      totalRafflePrice,
      paymentImage,
    } = body;

    // raffles sale
    if (raffles.length > 0) {
      const salesCollection = db.collection("sales");

      await salesCollection.add({
        phone,
        name,
        email,
        paymentConceptKey,
        raffles,
        ticketCount,
        allTickets,
        totalRafflePrice,
        paymentImage,
      });

      console.log("tickets number: ", body.ticketCount);
      // set tickets as sold
      if (ticketCount < 6) {
        await Promise.all(
          raffles.map((raffle) =>
            setTicketsAsSold(raffle.raffleId, raffle.ticketNumbers)
          )
        );
      }
    }

    // bets sale
    console.log("Bets", bets);
    if (bets.length > 0) {
      try {
        if (Array.isArray(bets) && bets.length > 0) {
          const salesBets = db.collection("salesBets");
          console.log("Adding betting sales...");
          await salesBets.add({
            name,
            phone,
            email,
            paymentConceptKey,
            bets,
            totalBetsPrice,
            paymentImage,
          });
          console.log("Registered betting sales");
        }
      } catch (err) {
        console.error("Error creating sale:", err);
      }
    }

    try {
      const data = req.body;
      console.log("Data received:", data);

      // Get the FCM token from the request body
      // check notificationTokens collection in Firestore and bring all token strings in a an array
      const notificationTokensCollection = db.collection("notificationTokens");
      const tokensSnapshot = await notificationTokensCollection.get();
      const fcmTokens: string[] = [];
      tokensSnapshot.forEach((doc) => {
        const tokenData = doc.data();
        if (tokenData.token && tokenData.enabled !== false) {
          fcmTokens.push(tokenData.token);
        }
      });
      if (fcmTokens.length === 0) {
        res.status(400).json({
          status: 400,
          message: "FCM token is required",
        });
        return;
      }

      // Send the message using Firebase Cloud Messaging
      const response = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        ...buildNotificationPayload({
          title: "Nueva compra pendiente de confirmación",
          body: "Hay una compra nueva. Revisa los detalles en el panel de administración.",
          destination: "adminSales",
          imageUrl:
            "https://firebasestorage.googleapis.com/v0/b/raffleapp-dbc1b.appspot.com/o/icon.jpg?alt=media&token=3f65205e-c8aa-4918-b6ab-2ff2209ad761",
        }),
      });
      await summarizeAndPruneMulticast("createSale", fcmTokens, response);
    } catch (error) {
      console.error("Error sending notification:", error);
    }

    res.status(200).json({
      status: 200,
      message: "Sale created successfully",
    });
  } catch (err) {
    console.error("Error creating sale: ", err);

    res.status(500).json({
      status: 500,
      message: "Error creating sale",
    });
  }
});

// PUBLIC: customer-facing bank-transfer checkout.
//
// WHY THIS IS NOT ADMIN-GUARDED
// Its only caller is app/checkout/transfer/page.tsx, which every customer
// reaches from the public cart. The previous flow called the admin-only
// `checkTransfer` from that page: no ID token was sent, every purchase got a
// 401, and the page redirected to the success screen anyway. Admin-guarding the
// customer path is what broke it, so trust here comes from server-side
// validation instead of a role (same model as `createCheckoutSession`):
//   - `verified`, the totals and the ticket sale state are decided here;
//   - prices are recomputed from the raffle/bet documents, never from the body;
//   - ticket numbers must exist and be unsold, checked inside a transaction,
//     so the transfer path cannot double-sell;
//   - the client only contributes what it legitimately owns: contact details
//     and the uploaded receipt URL.
// A signed-in customer's ID token is optional and only recorded as `userId`.
const TRANSFER_AUTO_CONFIRM_LIMIT = 5;
const MAX_TRANSFER_LINE_ITEMS = 20;
const MAX_TICKETS_PER_LINE = 50;
// Firestore allows at most 30 values in an `in` filter; stay well under it.
const TICKET_QUERY_CHUNK = 10;

interface TransferRaffleLine {
  raffleId: string;
  raffleName: string;
  pricePerTicket: number;
  ticketNumbers: number[];
  raffleTotalPrice: number;
}

interface TransferBetLine {
  betId: string;
  betName: string;
  team: string;
  letterTeam: string;
  ticketNumbers: number;
  totalPrice: number;
}

function transferPrice(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function transferCount(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function transferBadRequest(message: string): functions.https.HttpsError {
  return new functions.https.HttpsError("invalid-argument", message);
}

function transferConflict(message: string): functions.https.HttpsError {
  return new functions.https.HttpsError("failed-precondition", message);
}

export const createTransferSale = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ status: 405, message: "Method Not Allowed" });
    return;
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Optional identity: recorded for reconciliation, not required for a sale.
    let userId: string | null = null;
    const authorization = req.headers.authorization;
    if (authorization) {
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer" || !token) {
        res.status(401).json({
          status: 401,
          message: "Invalid or expired session.",
        });
        return;
      }
      try {
        userId = (await admin.auth().verifyIdToken(token)).uid;
      } catch {
        res.status(401).json({
          status: 401,
          message: "Invalid or expired session.",
        });
        return;
      }
    }

    // ----- contact details (the part the client legitimately owns) -----
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 5 || name.length > 50) {
      throw transferBadRequest("Ingresa tu nombre completo (5 a 50 caracteres).");
    }

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!/^\d{10}$/.test(phone)) {
      throw transferBadRequest("Ingresa un número de teléfono de 10 dígitos.");
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (
      email !== "" &&
      (email.length > 50 ||
        !/^[a-zA-Z0-9]+([._+-]?[a-zA-Z0-9-]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,10})+$/.test(
          email
        ))
    ) {
      throw transferBadRequest("Ingresa un correo electrónico válido.");
    }

    const paymentConceptKey =
      typeof body.paymentConceptKey === "string"
        ? body.paymentConceptKey.trim()
        : "";
    if (!/^\d{16}$/.test(paymentConceptKey)) {
      throw transferBadRequest("La clave del concepto de pago no es válida.");
    }

    const paymentImage =
      typeof body.paymentImage === "string" ? body.paymentImage.trim() : "";
    if (!/^https:\/\/\S+$/.test(paymentImage) || paymentImage.length > 2048) {
      throw transferBadRequest("Sube una imagen de tu comprobante de transferencia.");
    }

    const rawRaffles = Array.isArray(body.raffles) ? body.raffles : [];
    const rawBets = Array.isArray(body.bets) ? body.bets : [];
    if (rawRaffles.length === 0 && rawBets.length === 0) {
      throw transferBadRequest("Tu carrito está vacío.");
    }
    if (
      rawRaffles.length > MAX_TRANSFER_LINE_ITEMS ||
      rawBets.length > MAX_TRANSFER_LINE_ITEMS
    ) {
      throw transferBadRequest("Tu carrito tiene demasiados artículos.");
    }

    // ----- raffles: price and availability are derived server-side -----
    const raffleLines: TransferRaffleLine[] = [];
    for (const entry of rawRaffles) {
      const item = (entry ?? {}) as Record<string, unknown>;
      const raffleId = typeof item.raffleId === "string" ? item.raffleId.trim() : "";
      if (!raffleId) throw transferBadRequest("Falta el identificador de la rifa.");

      const numbersRaw = Array.isArray(item.ticketNumbers) ? item.ticketNumbers : [];
      const ticketNumbers: number[] = [];
      for (const value of numbersRaw) {
        const number = transferCount(value);
        if (number === null || number > 1000000) {
          throw transferBadRequest("Número de boleto inválido.");
        }
        if (!ticketNumbers.includes(number)) ticketNumbers.push(number);
      }
      if (ticketNumbers.length === 0 || ticketNumbers.length > MAX_TICKETS_PER_LINE) {
        throw transferBadRequest(
          `Selecciona entre 1 y ${MAX_TICKETS_PER_LINE} boletos por rifa.`
        );
      }

      const raffleSnap = await db.collection("raffles").doc(raffleId).get();
      if (!raffleSnap.exists) {
        throw transferBadRequest("Una de las rifas ya no está disponible.");
      }
      const raffleData = raffleSnap.data() as {
        title?: unknown;
        pricePerTicket?: unknown;
        numberOfTickets?: unknown;
      };

      // The body's price is ignored; this is the only price that counts.
      const pricePerTicket = transferPrice(raffleData.pricePerTicket);
      if (pricePerTicket === null) {
        throw transferConflict("No pudimos validar el precio de la rifa.");
      }

      const declaredTickets = transferCount(raffleData.numberOfTickets);
      if (declaredTickets !== null) {
        const outOfRange = ticketNumbers.filter((n) => n >= declaredTickets);
        if (outOfRange.length > 0) {
          throw transferBadRequest("Número de boleto inválido.");
        }
      }

      raffleLines.push({
        raffleId,
        raffleName:
          typeof raffleData.title === "string" ? raffleData.title : "",
        pricePerTicket,
        ticketNumbers,
        raffleTotalPrice: pricePerTicket * ticketNumbers.length,
      });
    }

    // ----- bets: same rule, price read from the bet document -----
    const betLines: TransferBetLine[] = [];
    for (const entry of rawBets) {
      const item = (entry ?? {}) as Record<string, unknown>;
      const betId = typeof item.betId === "string" ? item.betId.trim() : "";
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(betId)) {
        throw transferBadRequest("Identificador de apuesta inválido.");
      }

      const letterTeam =
        typeof item.letterTeam === "string" ? item.letterTeam.trim().toUpperCase() : "";
      if (letterTeam !== "A" && letterTeam !== "B" && letterTeam !== "C") {
        throw transferBadRequest("Selecciona un equipo válido para la apuesta.");
      }

      const tickets = transferCount(item.ticketNumbers);
      if (tickets === null || tickets < 1 || tickets > 1000) {
        throw transferBadRequest("Cantidad de boletos de apuesta inválida.");
      }

      let betDoc = await db.collection("bets").doc(betId).get();
      let betData: Record<string, unknown> | undefined = betDoc.exists
        ? (betDoc.data() as Record<string, unknown>)
        : undefined;
      if (!betData) {
        // Bets created through `createBet` live in RTDB under the public id.
        const snapshot = await rtdb.ref(`bets/${betId}`).once("value");
        const value = snapshot.val();
        if (value && typeof value === "object") {
          betData = value as Record<string, unknown>;
        }
      }
      if (!betData) {
        throw transferBadRequest("Una de las apuestas ya no está disponible.");
      }

      // Server-side bet cutoff (backlog item 5): once the event date has
      // passed, no new transfer sales may include this bet. UI greys the bet
      // via `isFinished`, but the server must enforce the close time itself.
      const eventDate =
        typeof betData.date === "string" ? Date.parse(betData.date) : NaN;
      if (Number.isFinite(eventDate) && eventDate <= Date.now()) {
        throw transferConflict("Esta apuesta ya cerró.");
      }

      const pricePerTicket = transferPrice(betData.pricePerTicket);
      if (pricePerTicket === null) {
        throw transferConflict("No pudimos validar el precio de la apuesta.");
      }

      const teams = (betData.teams ?? {}) as Record<string, unknown>;
      const teamName =
        letterTeam === "A"
          ? teams.a
          : letterTeam === "B"
          ? teams.b
          : "Empate";

      betLines.push({
        betId,
        betName: typeof betData.title === "string" ? betData.title : "",
        team: typeof teamName === "string" ? teamName : "",
        letterTeam,
        ticketNumbers: tickets,
        totalPrice: pricePerTicket * tickets,
      });
    }

    const ticketCount = raffleLines.reduce(
      (total, line) => total + line.ticketNumbers.length,
      0
    );
    const totalRafflePrice = raffleLines.reduce(
      (total, line) => total + line.raffleTotalPrice,
      0
    );
    const totalBetsPrice = betLines.reduce(
      (total, line) => total + line.totalPrice,
      0
    );
    const totalSalePrice = totalRafflePrice + totalBetsPrice;

    // Small transfers are auto-confirmed (same rule the old handler applied);
    // anything larger waits for an admin, and the client cannot influence it.
    const autoConfirm =
      ticketCount > 0 && ticketCount <= TRANSFER_AUTO_CONFIRM_LIMIT;

    // Resolve the ticket documents up front so the transaction only has to
    // re-read documents it can lock.
    const ticketRefs: admin.firestore.DocumentReference[] = [];
    for (const line of raffleLines) {
      for (let i = 0; i < line.ticketNumbers.length; i += TICKET_QUERY_CHUNK) {
        const chunk = line.ticketNumbers.slice(i, i + TICKET_QUERY_CHUNK);
        const snapshot = await db
          .collection("tickets")
          .where("raffle_id", "==", line.raffleId)
          .where("number", "in", chunk)
          .get();
        const found = new Set(
          snapshot.docs.map((doc) => transferCount(doc.get("number")))
        );
        const missing = chunk.filter((number) => !found.has(number));
        if (missing.length > 0) {
          throw transferConflict(
            `El boleto ${missing.join(", ")} de "${line.raffleName}" ya no está disponible.`
          );
        }
        snapshot.docs.forEach((doc) => ticketRefs.push(doc.ref));
      }
    }

    // The payment concept key is chosen by the browser but is unique per
    // attempt, so it doubles as the idempotency key for retries: a double tap
    // cannot record the same transfer twice.
    const saleRef = db.collection("sales").doc(`transfer_${paymentConceptKey}`);
    const salesBetsRef = db
      .collection("salesBets")
      .doc(`transfer_${paymentConceptKey}`);
    const verified = autoConfirm;

    let duplicate = false;
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(saleRef);
      if (existing.exists) {
        duplicate = true;
        return;
      }

      if (ticketRefs.length > 0) {
        const ticketSnaps = await transaction.getAll(...ticketRefs);
        for (const snap of ticketSnaps) {
          if (!snap.exists) {
            throw transferConflict("Uno de los boletos ya no está disponible.");
          }
          if (snap.get("sold") === true) {
            throw transferConflict(
              `El boleto ${snap.get("number")} ya fue vendido. Elige otro.`
            );
          }
        }
        // Tickets are only marked sold when this sale is auto-confirmed; for
        // larger transfers an admin confirms, exactly as the UI promises.
        if (autoConfirm) {
          ticketSnaps.forEach((snap) =>
            transaction.update(snap.ref, { sold: true })
          );
        }
      }

      if (raffleLines.length > 0) {
        transaction.set(saleRef, {
          userId,
          source: "transfer",
          paymentMethod: "transfer",
          name,
          phone,
          email,
          paymentConceptKey,
          paymentImage,
          raffles: raffleLines,
          ticketCount,
          totalRafflePrice,
          totalSalePrice,
          verified,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (betLines.length > 0) {
        transaction.set(salesBetsRef, {
          userId,
          paymentMethod: "transfer",
          name,
          phone,
          email,
          paymentConceptKey,
          paymentImage,
          bets: betLines,
          totalBetsPrice,
          totalSalePrice,
          verified: false, // bets are always confirmed by an admin
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    // Best effort: tell the admins a transfer is waiting for confirmation.
    if (!duplicate) {
      try {
        const tokensSnapshot = await db.collection("notificationTokens").get();
        const tokens: string[] = [];
        tokensSnapshot.forEach((doc) => {
          const token = doc.get("token");
          // Respect the per-device opt-out (Notificaciones page, 2026-10-25).
          if (typeof token === "string" && token && doc.get("enabled") !== false)
            tokens.push(token);
        });
        if (tokens.length > 0) {
          const response = await admin.messaging().sendEachForMulticast({
            tokens,
            ...buildNotificationPayload({
              title: "Nueva compra por transferencia",
              body: `Nueva compra por $${totalSalePrice} (${ticketCount} boletos). Pendiente de confirmación.`,
              destination: "adminSales",
            }),
          });
          await summarizeAndPruneMulticast("transferSale", tokens, response);
        }
      } catch (error) {
        console.warn("Transfer sale notification failed:", error);
      }
    }

    res.status(200).json({
      status: 200,
      message: duplicate
        ? "La compra ya estaba registrada."
        : "Sale created successfully",
      saleId: raffleLines.length > 0 ? saleRef.id : null,
      saleBetId: betLines.length > 0 ? salesBetsRef.id : null,
      duplicate,
      verified,
      ticketCount,
      totalSalePrice,
    });
  } catch (err) {
    if (err instanceof functions.https.HttpsError) {
      const status =
        err.code === "invalid-argument"
          ? 400
          : err.code === "failed-precondition"
          ? 409
          : err.code === "unauthenticated"
          ? 401
          : 500;
      res.status(status).json({ status, message: err.message });
      return;
    }
    console.error("Error creating transfer sale:", err);
    res.status(500).json({
      status: 500,
      message: "Error creating sale",
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const updateRaffle = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "PATCH, OPTIONS")) return;
  // Manejar solicitud preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "PATCH") {
    res.status(405).send({ message: "Only POST requests are allowed" });
    return;
  }

  try {
    console.log("Updating raffle info...");
    const body = req.body;

    await db
      .collection("raffles")
      .doc(body.idRaffle)
      .set(body.raffle, { merge: true });
    await logAdminAction(req.headers.authorization, "updateRaffle", {
      id: body.idRaffle,
    });

    res.status(200).json({
      status: 200,
      message: "Raffle correctly updated",
    });
  } catch (err) {
    console.error("Error updating raffle: ", err);

    res.status(500).json({
      status: 500,
      message: "Error updating raffle",
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const deleteRaffle = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "DELETE, OPTIONS")) return;
  // Manejar solicitud preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "DELETE") {
    res.status(405).send({ message: "Only DELETE requests are allowed" });
    return;
  }

  try {
    console.log("Deleting raffle...");
    const body = req.body;

    await db.collection("raffles").doc(body.idRaffle).delete();

    const snapshot = await db
      .collection("tickets")
      .where("raffle_id", "==", body.idRaffle)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(
      `Se eliminaron ${snapshot.size} ticket(s) con raffle_id: ${body.idRaffle}`
    );
    await logAdminAction(req.headers.authorization, "deleteRaffle", {
      id: body.idRaffle,
      ticketsDeleted: snapshot.size,
    });

    res.status(200).json({
      status: 200,
      message: "Raffle and tickets correctly deleted",
    });
  } catch (err) {
    console.error("Error deleting raffle: ", err);

    res.status(500).json({
      status: 500,
      message: "Error deleting raffle",
    });
  }
});

// PUBLIC: read-only storefront data. No auth by design.
export const getAllBets = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    // Get bets from Realtime Database for real-time data
    // B5: bound the read — the storefront only needs the newest bets, so the
    // RTDB read is capped at the 200 most recent instead of the whole node.
    const betsRef = rtdb.ref("bets");
    const snapshot = await betsRef
      .orderByChild("createdAt")
      .limitToLast(200)
      .once("value");
    const betsData = snapshot.val();

    if (!betsData) {
      res.status(200).json({ result: [] });
      return;
    }

    // Transform betsData object into an array with IDs
    const result = Object.keys(betsData).map((key) => ({
      id: key,
      ...betsData[key],
    }));

    res.status(200).json({
      result,
    });
  } catch (err) {
    console.error("Error fetching bets from Realtime Database:", err);
    // B6: RTDB is the single source of truth for bets. The Firestore fallback
    // was removed on purpose — a second store that not every write path keeps
    // in sync lets stale data shadow live data. Fail loudly instead.
    res.status(500).json({
      status: 500,
      message: "Error fetching bets",
    });
  }
});

// PUBLIC: read-only storefront data. No auth by design.
export const getBetData = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    const data = req.body;
    console.log("getBetData request data:", data);
    const id = data.id;

    if (!id) {
      res.status(400).json({ error: "Invalid ID provided" });
      return;
    }

    // Get bet data from Realtime Database first
    const betRef = rtdb.ref(`bets/${id}`);
    const snapshot = await betRef.once("value");
    const betData = snapshot.val();

    if (!betData) {
      // Fallback to Firestore if not found in Realtime Database
      console.log("Bet not found in Realtime Database, checking Firestore...");

      const betsCollection = db.collection("bets");
      const betsDoc = betsCollection.doc(id);
      const betsSnapshot = await betsDoc.get();

      if (!betsSnapshot.exists) {
        res.status(404).json({
          error: "Bet not found",
          data: null,
        });
        return;
      }

      const firestoreBetData = betsSnapshot.data();

      // Generate basic ticket data structure (if needed for compatibility)
      const betTicketsData = Array.from({ length: 100 }, (_, index) => ({
        number: index,
        sold: false,
        id: `ticket_${id}_${index}`,
        betId: id,
      }));

      res.status(200).json({
        betData: firestoreBetData,
        data: betTicketsData,
      });
      return;
    }

    // Generate ticket data structure for compatibility with existing frontend
    const betTicketsData = Array.from({ length: 100 }, (_, index) => ({
      number: index,
      sold: false,
      id: `ticket_${id}_${index}`,
      betId: id,
    }));

    console.log("Bet data retrieved from Realtime Database:", {
      betData,
      ticketCount: betTicketsData.length,
    });

    res.status(200).json({
      betData,
      data: betTicketsData,
    });
  } catch (error) {
    console.error("Error fetching bet data:", error);
    res.status(500).json({
      error: "Failed to fetch bet data",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const updateBet = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "PATCH, OPTIONS")) return;
  // Manejar solicitud preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "PATCH") {
    res.status(405).send({ message: "Only PATCH requests are allowed" });
    return;
  }

  try {
    console.log("Updating bet info...");
    const data = req.body;

    // B4: reject patches that would make a bet unusable (non-positive or
    // non-numeric price, or empty team names).
    const bet = data.bet || {};
    if (bet.pricePerTicket !== undefined) {
      const price = Number(bet.pricePerTicket);
      if (!Number.isFinite(price) || price <= 0) {
        res.status(400).json({
          status: 400,
          message: "Invalid bet data: pricePerTicket must be a positive number",
        });
        return;
      }
    }
    if (bet.teams !== undefined) {
      if (
        typeof bet.teams.a !== "string" ||
        bet.teams.a.trim() === "" ||
        typeof bet.teams.b !== "string" ||
        bet.teams.b.trim() === ""
      ) {
        res.status(400).json({
          status: 400,
          message: "Invalid bet data: both team names must be non-empty",
        });
        return;
      }
    }

    await db.collection("bets").doc(data.idBet).set(data.bet, { merge: true });

    // B6: mirror the patch to the RTDB copy — getAllBets/getBetData serve from
    // RTDB, so an edit that only lands in Firestore is invisible to the
    // storefront until RTDB fails. `.update` merges, and the admin client
    // omits server-owned fields (odds/counters), so counters are preserved.
    await rtdb.ref(`bets/${data.idBet}`).update(data.bet);

    res.status(200).json({
      status: 200,
      message: "Bet correctly updated",
    });
  } catch (err) {
    console.error("Error updating bet: ", err);
    res.status(500).json({
      message: "Error updating bet",
      status: 500,
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const deleteBet = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "DELETE, OPTIONS")) return;
  // Manejar solicitud preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "DELETE") {
    res.status(405).send({ message: "Only DELETE requests are allowed" });
    return;
  }

  try {
    console.log("Deleting bet...");
    const data = req.body;

    await db.collection("bets").doc(data.idBet).delete();

    // B6: keep the RTDB copy in sync so the deleted bet disappears from the
    // storefront listing immediately, not only on an RTDB outage.
    await rtdb.ref(`bets/${data.idBet}`).remove();

    res.status(200).json({
      status: 200,
      message: "Bet correctly deleted",
    });
  } catch (err) {
    console.error("Error deleting bet: ", err);
    res.status(500).json({
      status: 500,
      message: "Error deleting bet",
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const getSalesBets = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "GET, OPTIONS")) return;
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({
      status: 405,
      message: "Method Not Allowed",
    });
    return;
  }

  try {
    // B5: cap the read — admin sales list loads the newest 500 instead of
    // growing unbounded with every sale ever made.
    const betSalesCollection = db
      .collection("salesBets")
      .orderBy("createdAt", "desc")
      .limit(500);
    const betSalesSnapshot = await betSalesCollection.get();
    const betSales = betSalesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json({
      betSales,
    });
  } catch (err) {
    console.error("Error fetching sales:", err);
    res.status(500).json({
      status: 500,
      message: "Error fetching sales",
      error: err,
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const confirmRejectBetSale = functions.https.onRequest(
  async (req, res) => {
    if (await rejectUnlessAdmin(req, res, "GET, POST, OPTIONS")) return;
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({
        status: 405,
        message: "Method Not Allowed",
      });
      return;
    }

    try {
      const data = req.body;
      console.log("data", data);

      const { id, action } = data;

      if (!id || !action) {
        res.status(400).json({ status: 400, message: "Missing id or action" });
        return;
      }

      if (action !== "confirm" && action !== "reject") {
        res.status(400).json({
          status: 400,
          message: "Invalid action; must be 'confirm' or 'reject'",
        });
        return;
      }

      // Counters are recomputed from the PERSISTED sale document, never from
      // the client-sent `betSummary` (which is treated as a hint only). See
      // DESIGN-AUDIT.md B1 and BETS-MATH-AUDIT.md M7-M10.
      const saleRef = db.collection("salesBets").doc(String(id));
      const saleSnap = await saleRef.get();
      if (!saleSnap.exists) {
        res.status(404).json({ status: 404, message: "Sale not found" });
        return;
      }
      const sale = saleSnap.data() as Record<string, unknown>;
      const currentlyVerified = sale.verified === true;

      // Idempotency guard (M7/M8): a sale is applied exactly once per state
      // transition. Re-confirming a confirmed sale or re-rejecting a rejected
      // sale is a no-op, so double-clicks and replays cannot drift counters.
      if (action === "confirm" && currentlyVerified) {
        res.status(200).json({
          status: 200,
          message: "Bet sale already confirmed; no changes applied",
        });
        return;
      }
      if (action === "reject" && !currentlyVerified) {
        res.status(200).json({
          status: 200,
          message: "Bet sale already rejected; no changes applied",
        });
        return;
      }

      // Extract validated deltas from the persisted document only.
      const rawLines = Array.isArray(sale.bets) ? sale.bets : [];
      const deltas = new Map<
        string,
        { team: "A" | "B" | "C"; tickets: number }
      >();
      for (const line of rawLines) {
        const entry = (line ?? {}) as Record<string, unknown>;
        const betId = typeof entry.betId === "string" ? entry.betId : "";
        if (!betId) continue;
        const letter =
          typeof entry.letterTeam === "string"
            ? entry.letterTeam.trim().toUpperCase()
            : "";
        const team: "A" | "B" | "C" | null =
          letter === "A" || letter === "B" || letter === "C"
            ? letter
            : null;
        if (!team) continue; // legacy lines without a valid outcome never move counters (M9)
        const tickets = Number(entry.ticketNumbers);
        if (!Number.isFinite(tickets) || tickets <= 0) continue; // no string concatenation (M10)
        const existing = deltas.get(betId);
        deltas.set(betId, {
          tickets: (existing?.tickets ?? 0) + tickets,
          team: existing && existing.team !== team ? existing.team : team,
        });
      }
      if (deltas.size === 0) {
        res.status(400).json({
          status: 400,
          message: "Sale has no valid bet lines to process",
        });
        return;
      }

      // Firestore transaction guards the sale-doc state flip so two concurrent
      // admin clicks cannot both apply (B1). Counter updates use RTDB
      // transactions so concurrent sales on the same bet never lose an
      // increment.
      await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(saleRef);
        if (!fresh.exists) {
          throw new Error("Sale disappeared during transaction");
        }
        const freshVerified = (fresh.data() as Record<string, unknown>).verified === true;
        if (action === "confirm" && freshVerified) return; // lost race: already confirmed
        if (action === "reject" && !freshVerified) return; // lost race: already rejected
        transaction.update(saleRef, {
          verified: action === "confirm",
        });
      });

      const sign = action === "confirm" ? 1 : -1;
      for (const [betId, delta] of deltas) {
        const realTimeDbRef = rtdb.ref(`bets/${betId}`);
        await realTimeDbRef.transaction((betData: Record<string, unknown> | null) => {
          if (!betData) return betData; // bet not found; nothing to update
          const updated = { ...betData };
          const move = (field: string, amount: number) => {
            const current = Number(updated[field]) || 0;
            // Clamp at zero so a reject can never produce negative counters (M8).
            updated[field] = Math.max(0, current + sign * amount);
          };
          if (delta.team === "A") move("betsTeamA", delta.tickets);
          else if (delta.team === "B") move("betsTeamB", delta.tickets);
          else move("tieBets", delta.tickets);
          // totalBets is DERIVED, never incremented on its own. The three
          // outcome counters are the source of truth; keeping a separate
          // running total is how it drifts out of sync (and how it used to end
          // up absent, since createBet never wrote the key at all).
          updated.totalBets =
            (Number(updated.betsTeamA) || 0) +
            (Number(updated.betsTeamB) || 0) +
            (Number(updated.tieBets) || 0);
          return updated;
        });
      }

      res.status(200).json({
        status: 200,
        message: "Bet sale processed successfully",
      });
    } catch (err) {
      console.error("Error confirming bet sale:", err);
      res.status(500).json({
        status: 500,
        message: "Error confirming bet sale",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Bet settlement (pari-mutuel pool) — DESIGN-AUDIT.md B2, Option A.
//
// ADMIN ONLY. Triggered by an admin once the match has an official result:
//   POST { betId, result: "A" | "B" | "C" | "VOID" }
// "VOID" (match cancelled/abandoned with no official result) and a winning
// outcome with zero tickets both refund every ticket's full stake (see
// BETS-MODEL-RESEARCH.md section 3). Payout per winning ticket is
//   floor_to_centavo( poolCents × (1 − takeRate) / winningTickets )
// and settlement is idempotent: a bet can only be settled once.
// ---------------------------------------------------------------------------
async function readTakeRate(): Promise<number> {
  // Remote Config parameter `betsTakeRate` (e.g. "0.10"); falls back to the
  // documented default. Remote Config holds no secrets.
  try {
    const template = await remoteConfig.getTemplate();
    const param = template.parameters["betsTakeRate"];
    const raw =
      param?.defaultValue && "value" in param.defaultValue
        ? param.defaultValue.value
        : undefined;
    const sanitized = sanitizeTakeRate(raw);
    if (sanitized !== null) return sanitized;
  } catch (err) {
    console.warn("Could not read betsTakeRate from Remote Config:", err);
  }
  return DEFAULT_TAKE_RATE;
}

/** Outcome letter for a persisted salesBets bet line, or null if invalid. */
function lineOutcome(line: unknown): "A" | "B" | "C" | null {
  const entry = (line ?? {}) as Record<string, unknown>;
  const letter =
    typeof entry.letterTeam === "string"
      ? entry.letterTeam.trim().toUpperCase()
      : "";
  if (letter === "A" || letter === "B" || letter === "C") return letter;
  // Legacy docs may only carry the team NAME; match it against the bet teams.
  return null;
}

interface BetSaleLine {
  saleRef: admin.firestore.DocumentReference;
  ticketsByOutcome: { A: number; B: number; C: number };
}

interface BetSaleNotification {
  saleId: string;
  name: string;
  phone: string;
  email: string;
  userId: string | null;
  status: "paid" | "lost" | "refund";
  tickets: number;
  payoutCents: number;
}

function outcomeName(
  outcome: "A" | "B" | "C" | "VOID",
  teams: { a?: unknown; b?: unknown }
): string {
  if (outcome === "VOID") return "VOID (evento anulado)";
  if (outcome === "C") return "Empate";
  const name = outcome === "A" ? teams.a : teams.b;
  return typeof name === "string" && name.trim() !== ""
    ? name.trim()
    : `Equipo ${outcome}`;
}

/**
 * Batch winner/settlement notifications for a just-settled bet (backlog 13).
 *
 * Best effort: a notification failure never fails or rolls back settlement.
 * Channels, mirroring the app's existing infrastructure:
 *  - FCM push to the enabled tokens owned by each sale's userId. Private
 *    settlement details are never broadcast to the full device roster.
 *    Anonymous or unregistered sales still receive their in-app notification.
 *  - One in-app record per sale in the Firestore `notifications` collection,
 *    which is also the idempotency ledger: doc id `${betId}__${saleId}`.
 *    Re-settlement cannot duplicate sends because settleBet returns early on
 *    `settled === true`, and a record that already exists is skipped.
 */
async function notifyBetSettlement(
  betId: string,
  sourceBet: Record<string, unknown>,
  outcome: "A" | "B" | "C" | "VOID",
  perTicketCents: number,
  refundAll: boolean,
  sales: BetSaleNotification[]
): Promise<void> {
  try {
    if (sales.length === 0) return;
    const teams = (sourceBet.teams ?? {}) as { a?: unknown; b?: unknown };
    const title =
      typeof sourceBet.title === "string" && sourceBet.title.trim() !== ""
        ? sourceBet.title.trim()
        : betId;
    const winnerName = outcomeName(outcome, teams);
    const perTicket = (perTicketCents / 100).toFixed(2);
    const matchup = `${teams.a ?? "A"} vs ${teams.b ?? "B"}`;
    const notificationPath = `/bet/${encodeURIComponent(betId)}`;

    const tokensSnapshot = await db.collection("notificationTokens").get();
    const tokenRows: { userId: string; token: unknown; enabled?: unknown }[] = [];
    tokensSnapshot.forEach((doc) => {
      tokenRows.push({ userId: doc.id, token: doc.get("token"), enabled: doc.get("enabled") });
    });
    const userTokens = tokensByUser(tokenRows);

    for (const sale of sales) {
      const notifRef = db.doc(`notifications/${betId}__${sale.saleId}`);
      if ((await notifRef.get()).exists) continue; // idempotent re-send guard

      let notifType: string;
      let pushTitle: string;
      let body: string;
      if (refundAll) {
        notifType = "refund";
        pushTitle = "Apuesta reembolsada";
        body = `Tu apuesta en "${title}" (${matchup}) fue reembolsada: ${sale.tickets} boleto(s), $${perTicket} por boleto = $${(
          sale.payoutCents / 100
        ).toFixed(2)}. Bet: ${betId}.`;
      } else if (sale.status === "paid") {
        notifType = "won";
        pushTitle = "🏆 ¡Ganaste!";
        body = `Ganaste $${(sale.payoutCents / 100).toFixed(2)} en "${title}" (${matchup}): ganó ${winnerName}. ${sale.tickets} boleto(s) × $${perTicket}/boleto. Bet: ${betId}.`;
      } else {
        notifType = "lost";
        pushTitle = "Apuesta liquidada";
        body = `La apuesta "${title}" (${matchup}) fue liquidada: ganó ${winnerName}. Tus ${sale.tickets} boleto(s) no resultaron ganadores. Bet: ${betId}.`;
      }

      await notifRef.set({
        betId,
        saleId: sale.saleId,
        userId: sale.userId,
        name: sale.name,
        phone: sale.phone,
        email: sale.email,
        type: notifType,
        title: pushTitle,
        body,
        betTitle: title,
        matchup,
        winnerName,
        result: outcome,
        perTicketPayout: perTicketCents / 100,
        payout: sale.payoutCents / 100,
        tickets: sale.tickets,
        read: false,
        channel: "fcm+inapp",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const saleTokens = sale.userId ? userTokens.get(sale.userId) ?? [] : [];
      if (saleTokens.length > 0) {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: saleTokens,
          ...buildNotificationPayload({
            title: pushTitle,
            body,
            destination: "myPurchases",
            path: notificationPath,
          }),
          data: { betId, saleId: sale.saleId, type: notifType, url: notificationPath },
        });
        await summarizeAndPruneMulticast("settlement", saleTokens, response);
      }
    }
  } catch (err) {
    console.warn("Winner/settlement notifications failed (best effort):", err);
  }
}

export const settleBet = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "POST, OPTIONS")) return;
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ status: 405, message: "Only POST requests" });
    return;
  }

  try {
    const { betId, result } = req.body as {
      betId?: unknown;
      result?: unknown;
    };
    if (typeof betId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(betId)) {
      res.status(400).json({ status: 400, message: "Invalid betId" });
      return;
    }
    const outcome =
      typeof result === "string" ? result.trim().toUpperCase() : "";
    if (outcome !== "A" && outcome !== "B" && outcome !== "C" && outcome !== "VOID") {
      res.status(400).json({
        status: 400,
        message: 'Invalid result; must be "A", "B", "C", or "VOID"',
      });
      return;
    }

    const takeRate = await readTakeRate();

    // Load the bet (RTDB is the live source for admin-created bets; Firestore
    // mirrors it). Settlement state lives on both.
    const rtdbRef = rtdb.ref(`bets/${betId}`);
    const betSnapshot = await rtdbRef.once("value");
    const rtdbBet = betSnapshot.val() as Record<string, unknown> | null;
    const firestoreId = rtdbBet ? String(rtdbBet.firestoreId ?? "") : "";
    const firestoreBetRef = firestoreId
      ? db.collection("bets").doc(firestoreId)
      : null;
    const firestoreBetSnap = firestoreBetRef ? await firestoreBetRef.get() : null;
    const firestoreBet = firestoreBetSnap?.data() as Record<string, unknown> | undefined;

    if (!rtdbBet && !firestoreBet) {
      res.status(404).json({ status: 404, message: "Bet not found" });
      return;
    }

    const sourceBet = rtdbBet ?? firestoreBet!;
    // Idempotency: never settle twice.
    if (sourceBet.settled === true) {
      res.status(200).json({
        status: 200,
        message: "Bet already settled; no changes applied",
        alreadySettled: true,
      });
      return;
    }

    const pricePerTicket = Number(sourceBet.pricePerTicket);
    if (!Number.isFinite(pricePerTicket) || pricePerTicket <= 0) {
      res
        .status(400)
        .json({ status: 400, message: "Bet has an invalid pricePerTicket" });
      return;
    }

    // Recompute counters from the PERSISTED salesBets docs (M4/B1: never from
    // the live RTDB counters, which may have drifted).
    const salesSnapshot = await db.collection("salesBets").get();
    const salesByOutcome: BetSaleLine[] = [];
    const ticketsByOutcome = { A: 0, B: 0, C: 0 };
    salesSnapshot.forEach((doc) => {
      if (doc.get("verified") !== true) return;
      const rawLines = doc.get("bets");
      if (!Array.isArray(rawLines)) return;
      const saleLine: BetSaleLine = {
        saleRef: doc.ref,
        ticketsByOutcome: { A: 0, B: 0, C: 0 },
      };
      for (const line of rawLines) {
        const entry = (line ?? {}) as Record<string, unknown>;
        if (entry.betId !== betId) continue;
        const team = lineOutcome(line);
        if (!team) continue;
        const tickets = Number(entry.ticketNumbers);
        if (!Number.isFinite(tickets) || tickets <= 0) continue;
        saleLine.ticketsByOutcome[team] += tickets;
        ticketsByOutcome[team] += tickets;
      }
      if (
        saleLine.ticketsByOutcome.A +
          saleLine.ticketsByOutcome.B +
          saleLine.ticketsByOutcome.C >
        0
      ) {
        salesByOutcome.push(saleLine);
      }
    });

    const totalTickets = ticketsByOutcome.A + ticketsByOutcome.B + ticketsByOutcome.C;
    const pool = poolCents(totalTickets, pricePerTicket);
    const distributable = distributableCents(pool, takeRate);

    const isVoid = outcome === "VOID";
    const winningTickets = isVoid ? 0 : ticketsByOutcome[outcome as "A" | "B" | "C"];
    const refundAll = isVoid || winningTickets === 0;

    // Refund-all (void or zero winning tickets): every ticket gets its full
    // stake back and the organizer keeps nothing.
    const perTicketCents = refundAll
      ? toCents(pricePerTicket)
      : payoutPerTicketCents(distributable, winningTickets);

    // Write per-sale payout fields.
    const batch = db.batch();
    const saleNotifications: BetSaleNotification[] = [];
    for (const sale of salesByOutcome) {
      const winningForSale = isVoid
        ? 0
        : sale.ticketsByOutcome[outcome as "A" | "B" | "C"];
      const payoutForSaleCents = refundAll
        ? toCents(
            pricePerTicket *
              (sale.ticketsByOutcome.A +
                sale.ticketsByOutcome.B +
                sale.ticketsByOutcome.C)
          )
        : perTicketCents * winningForSale;
      const lineStatus = refundAll
        ? "refund"
        : winningForSale > 0
        ? "paid"
        : "lost";
      const saleDoc = await sale.saleRef.get();
      saleNotifications.push({
        saleId: sale.saleRef.id,
        name: String(saleDoc.get("name") ?? ""),
        phone: String(saleDoc.get("phone") ?? ""),
        email: String(saleDoc.get("email") ?? ""),
        userId: saleDoc.get("userId") ?? null,
        status: lineStatus as BetSaleNotification["status"],
        tickets:
          sale.ticketsByOutcome.A +
          sale.ticketsByOutcome.B +
          sale.ticketsByOutcome.C,
        payoutCents: payoutForSaleCents,
      });
      batch.update(sale.saleRef, {
        payout: payoutForSaleCents / 100,
        payoutStatus: lineStatus,
        [`settlements.${betId}`]: {
          result: outcome,
          payoutPerTicket: perTicketCents / 100,
          status: lineStatus,
          tickets: sale.ticketsByOutcome,
          takeRate,
          settledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
    await batch.commit();

    // Mark the bet settled with the outcome and per-ticket payout.
    const settledFields = {
      settled: true,
      result: outcome,
      payoutPerTicket: perTicketCents / 100,
      totalTickets,
      pool: pool / 100,
      takeRate,
      settledAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (firestoreBetRef && firestoreBetSnap?.exists) {
      await firestoreBetRef.update(settledFields);
    }
    await rtdbRef.update({ ...settledFields, settledAt: Date.now() });

    // Backlog 13: batch winner/settlement notifications (assisted-settlement
    // flow ratified 2026-10-25). Best effort; never blocks the response.
    await notifyBetSettlement(
      betId,
      sourceBet,
      outcome as "A" | "B" | "C" | "VOID",
      perTicketCents,
      refundAll,
      saleNotifications
    );

    res.status(200).json({
      status: 200,
      message: "Bet settled successfully",
      betId,
      result: outcome,
      refundAll,
      totalTickets,
      pool: pool / 100,
      takeRate,
      payoutPerTicket: perTicketCents / 100,
      salesUpdated: salesByOutcome.length,
      notificationsQueued: saleNotifications.length,
    });
  } catch (err) {
    console.error("Error settling bet:", err);
    res.status(500).json({
      status: 500,
      message: "Error settling bet",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// ADMIN ONLY: mutates data. Requires an admin ID token.
export const createBet = functions.https.onRequest(async (req, res) => {
  if (await rejectUnlessAdmin(req, res, "POST, OPTIONS")) return;
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({
      message: "Only POST requests are allowed",
    });
    return;
  }

  try {
    console.log("Processing bet creation request");
    const data = req.body;
    console.log("Bet data received:", data);

    // Validate required fields
    if (
      !data.title ||
      !data.description ||
      !data.pricePerTicket ||
      !data.teams
    ) {
      res.status(400).json({
        status: 400,
        message:
          "Missing required fields: title, description, pricePerTicket, teams",
      });
      return;
    }

    // B4: price must be a positive finite number and team names non-empty,
    // otherwise a $0 / unusable bet would go live silently.
    const price = Number(data.pricePerTicket);
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      typeof data.teams.a !== "string" ||
      data.teams.a.trim() === "" ||
      typeof data.teams.b !== "string" ||
      data.teams.b.trim() === ""
    ) {
      res.status(400).json({
        status: 400,
        message:
          "Invalid bet data: pricePerTicket must be a positive number and both team names must be non-empty",
      });
      return;
    }

    // Bets created from the gathered card carry a stable sourceKey (the matchup
    // id). Enforce uniqueness server-side so a double submit (or two admins)
    // can never create duplicate bets for the same matchup, and persist it for
    // future dedupe. The normal single-bet form sends no sourceKey -> null.
    const sourceKey = data.sourceKey ? String(data.sourceKey).trim() : "";
    if (sourceKey.length > 120) {
      res.status(400).json({ status: 400, message: "sourceKey too long" });
      return;
    }
    if (sourceKey) {
      const exists = await db
        .collection("bets")
        .where("sourceKey", "==", sourceKey)
        .limit(1)
        .get();
      if (!exists.empty) {
        res.status(409).json({
          status: 409,
          message: `Ya existe una apuesta para este enfrentamiento (${sourceKey}).`,
        });
        return;
      }
    }

    // Generate unique bet ID
    const betId = `bet_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    // Prepare bet data with initial values
    const betData = {
      title: data.title,
      description: data.description,
      image: data.image || "",
      date: data.date,
      pricePerTicket: price,
      teams: data.teams, // { a: string, b: string }
      oddsTeamA: data.oddsTeamA || "1.0",
      oddsTeamB: data.oddsTeamB || "1.0",
      ...(data.oddsTie ? { oddsTie: data.oddsTie } : {}),
      betsTeamA: 0,
      betsTeamB: 0,
      tieBets: 0,
      // Derived from the three counters above (see confirmRejectBetSale). Kept
      // in the record so clients never read `undefined`, but never incremented
      // independently.
      totalBets: 0,
      // Persist the card picker's configured initial pool (the old code
      // hardcoded 0, silently dropping the admin's pool value). Clamp sane.
      initialPool: Number.isFinite(Number(data.initialPool))
        ? Math.max(0, Number(data.initialPool))
        : 0,
      sourceKey: sourceKey || null,
      isFinished: false,
      createdAt: Date.now(),
    };

    // Add bet to Firestore collection (for backward compatibility and queries)
    const firestoreDocRef = await db.collection("bets").add(betData);
    console.log("Bet added to Firestore with ID:", firestoreDocRef.id);

    // Add bet to Realtime Database (for real-time updates)
    const realtimeRef = rtdb.ref(`bets/${betId}`);
    await realtimeRef.set({
      ...betData,
      firestoreId: firestoreDocRef.id,
    });
    console.log("Bet added to Realtime Database with ID:", betId);

    res.status(200).json({
      status: 200,
      data: {
        id: betId,
        firestoreId: firestoreDocRef.id,
        ...betData,
      },
      message: `Bet "${data.title}" created successfully`,
    });
  } catch (error) {
    console.error("Error creating bet:", error);
    res.status(500).json({
      status: 500,
      message: "An error occurred while creating the bet",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Function to get Remote Config values
// PUBLIC: read-only config used by the storefront UI. Do not put secrets in
// Remote Config.
export const getRemoteConfigValues = functions.https.onRequest(
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({
        status: 405,
        message: "Method Not Allowed",
      });
      return;
    }

    try {
      // Get the current Remote Config template
      const template = await remoteConfig.getTemplate();

      // Extract parameter values
      const parameters = template.parameters;
      const configValues: { [key: string]: any } = {};

      for (const [key, parameter] of Object.entries(parameters)) {
        if (parameter.defaultValue && "value" in parameter.defaultValue) {
          configValues[key] = parameter.defaultValue.value;
        } else {
          configValues[key] = null;
        }
      }

      res.status(200).json({
        status: 200,
        configValues,
      });
    } catch (error) {
      console.error("Error fetching Remote Config:", error);
      res.status(500).json({
        status: 500,
        message: "Error fetching Remote Config",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// ---------------------------------------------------------------------------
// CLIENT (CUSTOMER) ENDPOINTS — user-gated, NEVER public, NEVER admin-only.
// Added 2026-10-25 with the client login (Model A identity). These verify the
// caller's Firebase ID token; ANY signed-in user may call them for their OWN
// data only. CORS runs before the auth check (see applyCors).
// ---------------------------------------------------------------------------

/** Verify the caller's ID token, returning their uid, or null (401 sent). */
async function resolveUserId(
  req: functionsV1.https.Request,
  res: express.Response
): Promise<string | null> {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ status: 401, message: "Inicia sesión para continuar." });
    return null;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    res.status(401).json({ status: 401, message: "Invalid or expired session." });
    return null;
  }
}

/**
 * USER-GATED: purchase history for the signed-in client (Mis compras).
 * Returns the caller's `sales` (raffles) and `salesBets` (bets) docs —
 * matched server-side on `userId == auth.uid`, the identity createTransferSale
 * captures from the checkout's Bearer token. Legacy anonymous purchases have
 * no userId and are intentionally NOT returned here; the client merges its
 * legacy localStorage history as the device-association fallback.
 */
export const getMyPurchases = functions.https.onRequest(async (req, res) => {
  if (applyCors(req, res, "POST, OPTIONS")) return;
  if (req.method !== "POST") {
    res.status(405).json({ status: 405, message: "Method Not Allowed" });
    return;
  }
  const uid = await resolveUserId(req, res);
  if (!uid) return;

  try {
    const purchases: Record<string, unknown>[] = [];

    const salesSnapshot = await db
      .collection("sales")
      .where("userId", "==", uid)
      .get();
    salesSnapshot.forEach((doc) => {
      purchases.push({
        id: doc.id,
        kind: "raffle",
        createdAt: doc.get("createdAt") ?? null,
        verified: doc.get("verified") === true,
        totalSalePrice: doc.get("totalSalePrice") ?? doc.get("totalRafflePrice") ?? 0,
        raffles: doc.get("raffles") ?? [],
      });
    });

    const salesBetsSnapshot = await db
      .collection("salesBets")
      .where("userId", "==", uid)
      .get();
    salesBetsSnapshot.forEach((doc) => {
      purchases.push({
        id: doc.id,
        kind: "bet",
        createdAt: doc.get("createdAt") ?? null,
        verified: doc.get("verified") === true,
        totalSalePrice: doc.get("totalSalePrice") ?? doc.get("totalBetsPrice") ?? 0,
        payout: doc.get("payout") ?? null,
        payoutStatus: doc.get("payoutStatus") ?? null,
        settlements: doc.get("settlements") ?? null,
        bets: doc.get("bets") ?? [],
      });
    });

    res.status(200).json({ status: 200, purchases });
  } catch (err) {
    console.error("getMyPurchases failed:", err);
    res.status(500).json({ status: 500, message: "No pudimos cargar tus compras." });
  }
});

/**
 * USER-GATED: send a test FCM push to the CALLER's own registered device.
 * Reads `notificationTokens/{uid}` (the doc the rules tie to
 * tokenId == request.auth.uid) and sends only to that single token. A caller
 * can never push to another user's device, and there is no unauthenticated
 * path. 404 when the device has not registered yet.
 */
export const sendTestPush = functions.https.onRequest(async (req, res) => {
  if (applyCors(req, res, "POST, OPTIONS")) return;
  if (req.method !== "POST") {
    res.status(405).json({ status: 405, message: "Method Not Allowed" });
    return;
  }
  const uid = await resolveUserId(req, res);
  if (!uid) return;

  try {
    const tokenDoc = await db.collection("notificationTokens").doc(uid).get();
    const token = tokenDoc.get("token");
    if (tokenDoc.get("enabled") === false) {
      res.status(409).json({
        status: 409,
        message: "Las notificaciones están desactivadas para este dispositivo.",
      });
      return;
    }
    if (typeof token !== "string" || !token) {
      res.status(404).json({
        status: 404,
        message: "Este dispositivo aún no está registrado para notificaciones.",
      });
      return;
    }
    await admin.messaging().send({
      token,
      notification: {
        title: "Notificación de prueba",
        body: "Si ves esto, las notificaciones de Rifas Mtz funcionan en este dispositivo. 🔔",
      },
    });
    res.status(200).json({ status: 200, message: "Notificación de prueba enviada." });
  } catch (err: any) {
    console.error("sendTestPush failed:", err);
    // Surface the FCM-level reason (UNREGISTERED, SENDER_ID_MISMATCH, …) so a
    // silent drop is diagnosable from the client and the logs (item 20).
    res.status(500).json({
      status: 500,
      message: "No pudimos enviar la notificación de prueba.",
      fcmError: {
        code: err?.code ?? null,
        message: err?.message ?? String(err),
      },
    });
  }
});
