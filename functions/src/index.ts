import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { getDatabase } from "firebase-admin/database";

admin.initializeApp();
const db = admin.firestore();
const rtdb = getDatabase();

export const createQuickTicket = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
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
      const isWinner = Math.random() < 0.2;
      const symbols = getQuickTicketsSymbols(isWinner);

      const ticketData = {
        id: ticketId,
        status: "pending",
        symbols,
        activationCode,
        createdAt: Date.now(),
        isWinner,
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

const getQuickTicketsSymbols = (isWinner: boolean): string[] => {
  const symbols = [
    "🍀", // Lucky Clover
    "🎉", // Party Popper
    "💰", // Money Bag
    "🎁", // Gift
    "🌟", // Star
    "🏆", // Trophy
    "🎈", // Balloon
    "🥇", // Gold Medal
    "🎊", // Confetti Ball
    "💎", // Gem Stone
    "🍭", // Lollipop
    "🍫", // Chocolate Bar
    "🍩", // Doughnut
  ];
  // Make sure a non-winner does not have 3 or more of the same symbol out of 6
  if (!isWinner) {
    const randomSymbols: string[] = [];
    while (randomSymbols.length < 6) {
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      // Allow at most 2 of the same symbol
      if (randomSymbols.filter((s) => s === randomSymbol).length < 2) {
        randomSymbols.push(randomSymbol);
      }
    }
    return randomSymbols;
  } else {
    // If it's a winner, return at least 3 of the same symbol
    const winnerSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    const randomSymbols: string[] = Array(3).fill(winnerSymbol);
    while (randomSymbols.length < 6) {
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      // Allow at most 2 of the same symbol
      if (randomSymbols.filter((s) => s === randomSymbol).length < 2) {
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
    res.status(204).send(""); // Respuesta sin contenido para OPTIONS
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

    console.log("Processing sale by tranfer");
    const body = req.body;
    raffles = body.raffles;

    const salesCollection = db.collection("sales");
    await salesCollection.add(body);

    console.log("Numero de tickets: ", body.ticketCount);
    // set tickets as sold
    if (body.ticketCount < 6) {
      await Promise.all(
        raffles.map((raffle) =>
          setTicketsAsSold(raffle.raffleId, raffle.ticketNumbers)
        )
      );
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
