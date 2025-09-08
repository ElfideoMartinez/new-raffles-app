import * as functions from "firebase-functions";
import crypto from "crypto";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { getDatabase } from "firebase-admin/database";
import { getRemoteConfig } from "firebase-admin/remote-config";

admin.initializeApp();
const db = admin.firestore();
const rtdb = getDatabase();
const remoteConfig = getRemoteConfig();

export const sendPurchaseNotifications = functions.https.onRequest(
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method == "OPTIONS") {
      res.status(204).send("");
      return;
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
        if (tokenData.token) {
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

      // Create a message to send
      const message = {
        notification: {
          title: "Nueva compra por recibida",
          body: `Nueva compra por transferencia favor de confirmar ASAP`,
        },
        token: fcmTokens,
      };

      // Send the message using Firebase Cloud Messaging
      const response = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title: message.notification.title,
          body: message.notification.body,
          imageUrl:
            "https://firebasestorage.googleapis.com/v0/b/raffleapp-dbc1b.appspot.com/o/icon.jpg?alt=media&token=3f65205e-c8aa-4918-b6ab-2ff2209ad761",
        },
      });
      console.log("Successfully sent message:", response);

      res.status(200).json({
        status: 200,
        message: "Notification sent successfully",
        response,
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

export const markTicketsAsSold = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
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
export const createSale = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
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
export const success = functions.https.onRequest(async (req, res) => {
  // Handle preflight OPTIONS request for CORS
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send(""); // Respond with no content
    return;
  }

  // Set CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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

export const createCheckoutSession = functions.https.onRequest(
  async (req, res) => {
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send(""); // Respond with no content
      return;
    }

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method !== "POST") {
      res.status(405).json({
        status: 405,
        message: "Method Not Allowed",
      });
      return;
    }

    const data = req.body;
    console.log(data);

    const stripe = new Stripe(
      "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"
    );

    try {
      // Create a new price for the raffle ticket
      const newPrice = await stripe.prices.create({
        unit_amount: data.total * 100, // converting to cents
        currency: "mxn",
        product_data: {
          name: "Monto total",
        },
      });

      const isProduction = process.env.NODE_ENV === "production";
      console.log(process.env.NODE_ENV);

      // Create a checkout session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded",
        line_items: [
          {
            price: newPrice.id,
            quantity: 1,
          },
        ],
        phone_number_collection: {
          enabled: true,
        },
        metadata: {
          totalSalePrice: data.totalSalePrice,
          ticketCount: data.ticketCount,
          raffles: JSON.stringify(data.raffles),
        },
        return_url: isProduction
          ? "https://raffleapp-dbc1b.web.app/checkout/success"
          : "http://localhost:3000/checkout/success",
        //return_url: "https://raffleapp-dbc1b.web.app/checkout/success",
      });

      res.status(200).json({
        status: 200,
        body: { session },
      });
    } catch (err) {
      console.error("Error creating checkout session:", err);
      res.status(500).json({
        status: 500,
        message: "Error creating checkout session",
        error: err,
      });
    }
  }
);

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

    // Map the results, including the document ID
    const result = collectionSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
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

export const getSales = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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

export const rejectSale = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

export const confirmSale = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

export const createRaffle = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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

export const checkTransfer = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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
        if (tokenData.token) {
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

      // Create a message to send
      const message = {
        notification: {
          title: `Nueva compra por recibida ${
            raffles.length > 0 ? "de rifa" : "de apuestas"
          }`,
          body: `Nueva compra por ${
            raffles.length > 0 ? totalRafflePrice : totalBetsPrice
          } transferencia favor de confirmar ASAP`,
        },
        token: fcmTokens,
      };

      // Send the message using Firebase Cloud Messaging
      const response = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title: message.notification.title,
          body: message.notification.body,
          imageUrl:
            "https://firebasestorage.googleapis.com/v0/b/raffleapp-dbc1b.appspot.com/o/icon.jpg?alt=media&token=3f65205e-c8aa-4918-b6ab-2ff2209ad761",
        },
      });
      console.log("Successfully sent message:", response);
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

export const stripeWebHook = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // Manejar solicitud preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).send(""); // Respuesta sin contenido para OPTIONS
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({ message: "Only POST requests are allowed" });
    return;
  }

  const stripe = new Stripe(
    "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"
  );

  const endpointSecret = "whsec_DfOQcGKNocindFHvASZb10mapc0nE7AF";

  try {
    const body = req.body;
    console.log(body);

    const infoRaffle = body.data.object.metadata;
    const infoCustomer = body.data.object.customer_details;
    const paymentIntent = body.data.object.payment_intent;
    console.log("PaymentIntent: ", paymentIntent);

    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);

    if (event.type === "checkout.session.completed") {
      interface Raffle {
        raffleId: string;
        raffleName: string;
        ticketNumbers: number[];
        raffleTotalPrice: number;
      }
      let raffles: Raffle[];
      raffles = JSON.parse(infoRaffle.raffles);

      // add to sales collection
      const salesCollection = db.collection("sales");
      await salesCollection.add({
        payment_intent: paymentIntent || "",
        name: infoCustomer.name || "",
        phone: infoCustomer.phone || "",
        email: infoCustomer.email || "",
        ticketCount: infoRaffle.ticketCount || 0,
        totalSalePrice: infoRaffle.totalSalePrice || 0,
        raffles: raffles,
        paymentMethod: "card",
        verified: true,
      });

      await Promise.all(
        raffles.map((raffle) =>
          setTicketsAsSold(raffle.raffleId, raffle.ticketNumbers)
        )
      );
    }

    res.status(200).json({
      status: 200,
      message: "Webook working correctly",
    });
  } catch (err) {
    console.error("Error in webhook:", err);

    res.status(500).json({
      status: 500,
      message: "Error in webhook:",
    });
  }
});

export const updateRaffle = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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

export const deleteRaffle = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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
    const betsRef = rtdb.ref("bets");
    const snapshot = await betsRef.once("value");
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

    // Fallback to Firestore if Realtime Database fails
    try {
      console.log("Falling back to Firestore...");
      const betsCollection = db.collection("bets");
      const collectionSnapshot = await betsCollection.get();

      const result = collectionSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.status(200).json({
        result,
      });
    } catch (firestoreErr) {
      console.error("Error fetching bets from Firestore:", firestoreErr);
      res.status(500).json({
        status: 500,
        message: "Error fetching bets",
        error:
          firestoreErr instanceof Error
            ? firestoreErr.message
            : String(firestoreErr),
      });
    }
  }
});

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

export const updateBet = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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

    await db.collection("bets").doc(data.idBet).set(data.bet, { merge: true });

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

export const deleteBet = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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

export const getSalesBets = functions.https.onRequest(async (req, res) => {
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
    const betSalesCollection = db.collection("salesBets");
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

export const confirmRejectBetSale = functions.https.onRequest(
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

    interface IBetsSummary {
      betId: string;
      totalPrice: string;
      ticketNumbers: number;
      team: string; // 'A', 'B', o 'C'
    }

    try {
      const data = req.body;
      console.log("data", data);

      const { id, action, betSummary } = data;

      if (!id || !action || !betSummary) {
        res
          .status(400)
          .json({ status: 400, message: "Missing id, action, or betSummary" });
        return;
      }

      if (action !== "confirm" && action !== "reject") {
        res.status(400).json({
          status: 400,
          message: "Invalid action; must be 'confirm' or 'reject'",
        });
        return;
      }

      if (!Array.isArray(betSummary)) {
        res.status(400).json({
          status: 400,
          message: "Invalid betSummary; must be an array",
        });
        return;
      }

      const bets: IBetsSummary[] = betSummary;

      const betSaleRef = db.collection("salesBets").doc(id);
      const verifiedValue = action === "confirm";
      await betSaleRef.update({ verified: verifiedValue });

      const initialPoolKey = "initialPool";
      const betsTeamAKey = "betsTeamA";
      const betsTeamBKey = "betsTeamB";
      const tieBetsKey = "tieBets";

      const results = await Promise.all(
        bets.map(async (betData) => {
          try {
            const docRef = db.collection("bets").doc(betData.betId);
            const totalBetPrice = Number(betData.totalPrice);

            if (isNaN(totalBetPrice)) {
              throw new Error(`Invalid totalPrice for betId ${betData.betId}`);
            }

            const totalTickets = betData.ticketNumbers;
            const poolDelta =
              action === "reject" ? -totalBetPrice : totalBetPrice;
            const ticketsDelta =
              action === "reject" ? -totalTickets : totalTickets;

            await db.runTransaction(async (transaction) => {
              const doc = await transaction.get(docRef);

              if (!doc.exists) {
                throw new Error(
                  `Documento con betId ${betData.betId} no existe.`
                );
              }

              const data = doc.data();
              const currentInitialPool = data?.[initialPoolKey] ?? 0;
              const currentBetsTeamA = data?.[betsTeamAKey] ?? 0;
              const currentBetsTeamB = data?.[betsTeamBKey] ?? 0;
              const currentTieBets = data?.[tieBetsKey] ?? 0;

              const newInitialPool = currentInitialPool + poolDelta;
              let newBetsTeamA = currentBetsTeamA;
              let newBetsTeamB = currentBetsTeamB;
              let newTieBets = currentTieBets;

              if (betData.team === "A") {
                newBetsTeamA += ticketsDelta;
              } else if (betData.team === "B") {
                newBetsTeamB += ticketsDelta;
              } else if (betData.team === "C") {
                newTieBets += ticketsDelta;
              } else {
                throw new Error(
                  `Invalid team value '${betData.team}' for betId ${betData.betId}`
                );
              }

              transaction.update(docRef, {
                [initialPoolKey]: newInitialPool,
                [betsTeamAKey]: newBetsTeamA,
                [betsTeamBKey]: newBetsTeamB,
                [tieBetsKey]: newTieBets,
              });
            });

            return { betId: betData.betId, success: true };
          } catch (error) {
            console.error(
              `Error updating bet ${betData.betId} in transaction:`,
              error
            );
            return {
              betId: betData.betId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      res.status(200).json({
        status: 200,
        message: "Bet sale processed successfully",
        results,
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

export const createBet = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

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
      pricePerTicket: data.pricePerTicket,
      teams: data.teams, // { a: string, b: string }
      oddsTeamA: data.oddsTeamA || "1.0",
      oddsTeamB: data.oddsTeamB || "1.0",
      // Initialize betting statistics
      betsTeamA: 0,
      betsTeamB: 0,
      tieBets: 0,
      initialPool: 0,
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
