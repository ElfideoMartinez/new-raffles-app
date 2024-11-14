import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../firebaseconfig";
import { collection, getDocs } from "firebase/firestore";

export async function GET(request: NextRequest, response: NextResponse) {
  const allSales = collection(db, "sales");
  const salesSnapshot = await getDocs(allSales);
  const sales = salesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  return NextResponse.json({
    sales,
  });
}
