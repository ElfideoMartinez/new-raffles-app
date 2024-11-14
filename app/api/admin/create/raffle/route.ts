import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../firebaseconfig";
import { addDoc, collection } from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";

export async function POST(request: NextRequest, response: NextResponse) {
  console.log("Im being called");
  try {
    console.log("request");
    const body = await request.json();
    //insert in raflles collection
    const docRef = await addDoc(collection(db, "raffles"), body);
    //from body.numberOfTickets create the tickets from 0 to numberOfTickets
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
    //insert on tickets collection the tickets for the raffle and set the field raffleId with the id of the raffle
    const ticketsCollection = collection(db, "tickets");
    tickets.forEach(async (ticket) => {
      await addDoc(ticketsCollection, ticket);
    });
    return NextResponse.json({
      message: "Hello World",
      body: body,
    });
  } catch (e) {
    console.log(e);
    return NextResponse.json({
      message: "We have an error",
    });
  }
}
