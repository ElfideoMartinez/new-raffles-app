import { db } from "@/app/firebaseconfig";
import { doc, getDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import Stripe from "stripe";

// Single-raffle card checkout (Next route handler).
//
// NOTE ON SCOPE: this route is NOT called by the current UI — the checkout page
// posts to the `createCheckoutSession` Cloud Function (see
// app/checkout/card/page.tsx). It is kept because the audit asked for the
// secret to be removed regardless; it is deliberately single-raffle and does
// not write a sale (the signed Stripe webhook owns that).

interface CardCheckoutBody {
  raffleId: string;
  ticketNumbers: number[];
  email?: string;
  phone?: string;
}

function parseBody(raw: unknown): CardCheckoutBody | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const raffleId = typeof body.raffleId === "string" ? body.raffleId : "";
  if (!raffleId) return null;

  if (!Array.isArray(body.ticketNumbers) || body.ticketNumbers.length === 0) {
    return null;
  }
  const ticketNumbers = body.ticketNumbers.map((n) =>
    typeof n === "string" ? Number(n) : n
  );
  if (!ticketNumbers.every((n) => Number.isInteger(n) && (n as number) >= 0)) {
    return null;
  }

  return {
    raffleId,
    ticketNumbers: ticketNumbers as number[],
    email: typeof body.email === "string" ? body.email : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
  };
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY. Set it in .env.local (never commit it)."
    );
  }

  const body = parseBody(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json(
      {
        status: 400,
        message:
          "Invalid request. Expected raffleId and a non-empty ticketNumbers array.",
      },
      { status: 400 }
    );
  }

  try {
    // Price is always recomputed from Firestore; the client total is ignored.
    const raffleSnap = await getDoc(doc(db, "raffles", body.raffleId));
    if (!raffleSnap.exists()) {
      return NextResponse.json(
        { status: 404, message: "Raffle not found." },
        { status: 404 }
      );
    }
    const pricePerTicket = Number(raffleSnap.get("pricePerTicket"));
    if (!Number.isFinite(pricePerTicket) || pricePerTicket <= 0) {
      return NextResponse.json(
        { status: 400, message: "Raffle has no valid price." },
        { status: 400 }
      );
    }
    const total = pricePerTicket * body.ticketNumbers.length;

    const stripe = new Stripe(secretKey);

    //create stripe price
    const newPrice = await stripe.prices.create({
      unit_amount: Math.round(total * 100),
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

    return NextResponse.json({
      status: 200,
      body: { session },
    });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json(
      {
        status: 500,
        message: "Error creating checkout session",
      },
      { status: 500 }
    );
  }
}
