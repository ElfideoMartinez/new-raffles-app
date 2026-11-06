import { NextRequest, NextResponse } from "next/server";
import { db } from "../../firebaseconfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const id = data.id;
    if (!id) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid ID provided" }),
        { status: 400 }
      );
    }

    const rafflesCollection = collection(db, "raffles");
    const raffleDoc = doc(rafflesCollection, id);
    const raffleSnapshot = await getDoc(raffleDoc);

    if (!raffleSnapshot.exists()) {
      return new NextResponse(JSON.stringify({ data: null }), { status: 404 });
    }

    const raffleData = raffleSnapshot.data();
    const ticketsCollection = collection(db, "tickets");
    const q = query(ticketsCollection, where("raffle_id", "==", id));
    const querySnapshot = await getDocs(q);

    return new NextResponse(
      JSON.stringify({
        raffleData,
        data: querySnapshot.docs.map((doc) => ({
          ...doc.data(),
        })),
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching raffle data:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch raffle data" }),
      { status: 500 }
    );
  }
}