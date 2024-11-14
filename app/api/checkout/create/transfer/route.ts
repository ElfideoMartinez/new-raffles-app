import { db } from "@/app/firebaseconfig";
import { collection, addDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { NextApiResponse } from "next";
import { NextResponse } from "next/server";

export async function POST(request: Request, response: NextResponse) {
  if (request.method !== "POST") {
    return NextResponse.json({
      status: 405,
      message: "Method Not Allowed",
    });
  }
  const data = await request.json();

  const salesCollection = collection(db, "sales");
  try {
    console.log("Creating sale with data:", data);
    await addDoc(salesCollection, data);
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
