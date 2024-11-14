import { db } from "@/app/firebaseconfig";
import { addDoc, collection } from "firebase/firestore";
import { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request, response: NextApiResponse) {
  const data = await request.json();
  console.log(data);
  if (request.method !== "POST") {
    return NextResponse.json({
      status: 405,
      message: "Method Not Allowed",
    });
  }
  const stripe = new Stripe(
    "sk_test_51OhNGHFa61udd4SXwmS44glXYRaTibPKX7W3oRfejoQ7NTddDQw0MSjAFXBsGv8wdCBQoa1GDvFfjQMyLztjIpDH00Ohkhas7m"
  );

  try {
    //create stripe price
    const newPrice = await stripe.prices.create({
      unit_amount: data.total * 100,
      currency: "mxn",
      product_data: {
        name: "Raffle Ticket",
      },
    });
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      line_items: [
        {
          price: newPrice.id,
          quantity: 1,
        },
      ],
      redirect_on_completion: "never",
      phone_number_collection: {
        enabled: true,
      },
    });
    //add to sales collection
    const salesColection = collection(db, "sales");
    await addDoc(salesColection, {
      phone: data.phone || "",
      email: data.email || "",
      ticketCount: data.ticketCount || 0,
      ticketNumbers: data.ticketNumbers || [],
      totalSalePrice: data.totalSalePrice || 0,
      raffle_id: data.raffle_id || "",
      paymentMethod: "card",
      verified: true,
    });

    return NextResponse.json({
      status: 200,
      body: { session },
    });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json({
      status: 500,
      message: "Error creating checkout session",
      error: err,
    });
  }
}
