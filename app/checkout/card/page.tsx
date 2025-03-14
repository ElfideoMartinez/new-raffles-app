"use client";
import React, { useState, useEffect, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";

import useTicketStore from "../../store";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { env } from "process";

const stripePromise = loadStripe(
  "pk_test_51OhNGHFa61udd4SXroKyqczB8jmGHIAyLgdBpgqk1E85bJU3GeikWSylKDUEZdbOYypqyM8GFxiqC1FQ2UUGQNQ2007qKbxnjZ"
);

const CardCheckoutPage = () => {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedSession = useRef(false); // Add a ref to track if the API call was made
  const raffles = useTicketStore((state: any) => state.getItemsFromCart());
  const totalRafflePrice = raffles.reduce(
    (total: any, raffle: any) => total + (raffle.raffleTotalPrice || 0),
    0
  );
  const allTickets = raffles.flatMap((raffle: any) => raffle.ticketNumbers);
  const numberOfTickets = allTickets.length;
  //get raffle id from the first raffle in the cart
  const raffleId = raffles[0]?.raffleId;
  // function to set the type of payment
  const setPaymentMethod = useTicketStore((state) => state.setPaymentMethod);

  useEffect(() => {
    const iniStripe = async () => {
      try {
        const response = await fetch(
          //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/createCheckoutSession`,
          `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/createCheckoutSession`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({    
              total: totalRafflePrice,        
              ticketCount: numberOfTickets,
              totalSalePrice: totalRafflePrice,
              raffles: raffles,            
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch checkout session");
        }
        console.log("response", response);
        const result = await response.json();
        console.log("result", result);
        const { client_secret } = result.body.session;
        if (!client_secret) {
          throw new Error("Failed to fetch client secret");
          alert;
        }
        setClientSecret(client_secret);
        setPaymentMethod("card");
        setLoading(false);
      } catch (err) {
        console.error("Error fetching Stripe session:", err);
        setLoading(false);
      }
    };

    if (!hasFetchedSession.current) {
      iniStripe();
      hasFetchedSession.current = true; // Mark that the API call was made
    }
  }, []);

  if (loading) {
    return <div>Cargando...</div>; // Display loading state while fetching clientSecret
  }

  if (!clientSecret) {
    return <div>Error al cargar el formulario de pago</div>; // Display error if clientSecret isn't set
  }

  return (
    <div className='h-full' id='checkout'>
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret,
          onComplete: async () => {
            // const successPath = "/checkout/success";
            // router.push(successPath);
          },
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};

export default CardCheckoutPage;
