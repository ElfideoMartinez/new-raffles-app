import { NextRequest, NextResponse } from "next/server";
import firebaseApp, { db } from "../../firebaseconfig";
import { addDoc, collection, doc, getDoc, getDocs } from "firebase/firestore";

export async function GET(request: NextRequest) {
  //s
  //get the id from the request
  //get all raffles collection from firestore
  const rafflesCollection = collection(db, "raffles");
  //console log all the items in the raffles collection
  const collectionResult = await getDocs(rafflesCollection);
  //map result, including the id
  collectionResult.forEach((doc) => {
    console.log(doc.id, " => ", doc.data());
  });
  const result = collectionResult.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  return NextResponse.json({
    result,
  });
}
