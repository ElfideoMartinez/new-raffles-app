import { db } from "@/app/firebaseconfig";
import {
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  doc,
} from "firebase/firestore";
import { NextResponse } from "next/server";

//get that recives an id as a parameter
export async function POST(request: Request, response: NextResponse) {
  if (request.method !== "POST") {
    return NextResponse.json({
      status: 405,
      message: "Method Not Allowed",
    });
  }
  const data = await request.json();
  console.log("Data:", data);
  try {
    const ticketsCollection = collection(db, "tickets");
    const ticketQuerySnapshot = await getDocs(
      query(
        ticketsCollection,
        where("raffle_id", "==", data.raffle_id),
        where("number", "in", data.ticketNumbers)
      )
    );
    const updatePromises = ticketQuerySnapshot.docs.map((ticketDoc) =>
      updateDoc(doc(db, "tickets", ticketDoc.id), { sold: true })
    );
    //update sale to verified
    const saleUpdatePromise = updateDoc(doc(db, "sales", data.id), {
      verified: true,
    });
    await Promise.all([...updatePromises, saleUpdatePromise]);
    return NextResponse.json({
      status: 200,
      message: "Sale created successfully",
    });
  } catch (err) {
    console.error("Error creating sale:", err);
    return NextResponse.json({
      status: 500,
      message: "Error creating sale",
      error: err,
    });
  }
}
