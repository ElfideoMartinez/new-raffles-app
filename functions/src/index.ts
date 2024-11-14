import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

admin.initializeApp();
const db = admin.firestore();

export const getRaffleData = functions.https.onRequest(async (req, res) => {
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

    const ticketsData = ticketQuerySnapshot.docs.map((doc) => doc.data());
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

export const createCheckoutSession = functions.https.onRequest(
  async (req, res) => {
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
      "sk_test_51OhNGHFa61udd4SXwmS44glXYRaTibPKX7W3oRfejoQ7NTddDQw0MSjAFXBsGv8wdCBQoa1GDvFfjQMyLztjIpDH00Ohkhas7m"
    );

    try {
      // Create a new price for the raffle ticket
      const newPrice = await stripe.prices.create({
        unit_amount: data.total * 100, // converting to cents
        currency: "mxn",
        product_data: {
          name: "Raffle Ticket",
        },
      });

      // Create a checkout session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price: newPrice.id,
            quantity: 1,
          },
        ],
        phone_number_collection: {
          enabled: true,
        },
      });

      // Add sale details to Firestore
      const salesCollection = db.collection("sales");
      await salesCollection.add({
        phone: data.phone || "",
        email: data.email || "",
        ticketCount: data.ticketCount || 0,
        ticketNumbers: data.ticketNumbers || [],
        totalSalePrice: data.totalSalePrice || 0,
        raffle_id: data.raffle_id || "",
        paymentMethod: "card",
        verified: true,
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

export const confirmSale = functions.https.onRequest(async (req, res) => {
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
    const ticketQuerySnapshot = await ticketsCollection
      .where("raffle_id", "==", data.raffle_id)
      .where("number", "in", data.ticketNumbers)
      .get();

    const batch = db.batch();
    ticketQuerySnapshot.docs.forEach((ticketDoc) => {
      const ticketRef = ticketsCollection.doc(ticketDoc.id);
      batch.update(ticketRef, { sold: true });
    });

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
  console.log("Function called");

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
