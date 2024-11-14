import { NextApiRequest } from "next";
import Stripe from "stripe";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/app/firebaseconfig";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const data = await request.json();
  if (request.method !== "POST") {
    return NextResponse.json({
      status: 405,
      message: "Method Not Allowed",
    });
  }
  const { raffleId, ticketNumbers } = data;
  setTicketsAsSold(raffleId, ticketNumbers);
  return NextResponse.json({
    status: 200,
    message: "Tickets marked as sold",
  });
}
const setTicketsAsSold = async (raffleId: string, ticketNumbers: Number[]) => {
  ticketNumbers.forEach(async (ticketNumber) => {
    try {
      const ticketsRef = collection(db, "tickets");
      const q = query(
        ticketsRef,
        where("raffle_id", "==", raffleId),
        where("number", "==", ticketNumber)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (doc) => {
        console.log(`Ticket found: `, doc.id, doc.data());
        await updateDoc(doc.ref, { sold: true });
      });
      if (querySnapshot.empty) {
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
  });
};
