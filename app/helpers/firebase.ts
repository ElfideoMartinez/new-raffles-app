import { db } from "../firebaseconfig";
import { collection, addDoc } from "firebase/firestore";

export const addNewSale = async (sale: any) => {
  try {
    const docRef = await addDoc(collection(db, "sales"), {
      ...sale,
      verified: true,
      sold_to: "client",
      total: sale.ticketNumbers.length * 25,
      sale_date: new Date().toDateString(),
    });
  } catch (error) {
    console.error("Error adding sale", error);
  }
};