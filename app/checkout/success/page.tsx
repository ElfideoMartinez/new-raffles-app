"use client";
import { apiUrl } from "@/app/config/api";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import useTicketStore from "@/app/store";

interface IRaffle {
  raffleId: string;
  raffleName: string;
  ticketNumbers: number[];
  raffleTotalPrice: number;
};

interface IBet {
  betId: string;
  betName: string;
  team: string;
  letterTeam: string;
  ticketNumbers: number;
  totalPrice: number;
};

const SuccessPage = () => {
  const raffles = useTicketStore((state) => state.getItemsFromCart());
  const bets = useTicketStore((state) => state.getBetsFromCart());
  const cleanCart = useTicketStore((state) => state.cleanCart);
  const cleanBets = useTicketStore((state) => state.clearCartBets);
  const cleanSelected = useTicketStore((state) => state.clearSelectedTickets);

  const [isHydrated, setIsHydrated] = useState(false);
  const [ticketCount, setTicketCount] = useState(0);

  console.log("Tickets", ticketCount);
  useEffect(() => {
    // if(paymentMethod !== "transfer"){
    //   markAsSold();
    // }
    const count = raffles.map((raffle) => raffle.ticketNumbers.sort((a, b) => a - b)).flat().length;
    setTicketCount(count);
    saveSaleLocalStorage();

    cleanCart();
    cleanBets();
    cleanSelected();
    setIsHydrated(true);
  }, []);

  const saveSaleLocalStorage = () => {
    const saved = localStorage.getItem("purchases");
    let purchases: { date: string, raffles: IRaffle[], bets: IBet[] }[] = [];

    if (saved) {
      try {
        purchases = JSON.parse(saved);
      } catch (err) {
        console.error("Error parsing localStorage purchases");
      }
    }

    const newPurchase = {
      date: new Date().toISOString(), // puedes usar otra forma si lo prefieres
      raffles: raffles,
      bets: bets,
    };

    purchases.push(newPurchase);
    localStorage.setItem("purchases", JSON.stringify(purchases));
  }

  const markAsSold = async () => {
    const promises = raffles.map((raffle) =>
      fetch(apiUrl("success"), {
        cache: "default",
        method: "POST",
        body: JSON.stringify({
          raffleId: raffle.raffleId,
          ticketNumbers: raffle.ticketNumbers,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
    await Promise.all(promises);
  };

  if(!isHydrated){
    return(
      <div></div>
    )
  }

  return (
    <div className='flex flex-col w-full items-center mt-7 px-7 text-center gap-3'>
      <p>
    🎉 <strong>¡Gracias por tu compra!</strong> 🎉<br/><br/>
        Para conocer al ganador, ingresa a la página de la rifa el día que finalice.
      </p>
      <p> 
        Ahí mismo donde escogiste tus boletos se publicará el número ganador.<br/>
        ¡Guarda ese enlace y mucha suerte! 🍀
      </p>
      {ticketCount > 5 ? 
        <div>
          <p>Ojo 👀 <br></br>Como tu compra fue de mas de 5 boletos, tus boletos comprados seguiran apareciendo como disponibles,<br></br> 
          una vez verificada tu transferencia te lo haremos saber por medio de whatsapp y tus boletos apareceran como vendidos.</p>
        </div> 
      : 
        <div>
          <p>✅ Hemos registrado tu compra por transferencia. <br></br>
            Una vez que verifiquemos el pago, te avisaremos por WhatsApp.</p>
        </div>
      }
      <p>Si tienes cualquier duda o necesitas más información, no dudes en ponerte en contacto con nosotros</p>
      <p>📧 Correo: ealejandramtzq04@gmail.com<br/>
         📞 Telefono: 6391316226
      </p>
      <Link href='../' className='p-2 mt-4 rounded-md' style={{ backgroundColor: '#355b6eff'}}>
        Ir a inicio
      </Link>
    </div>
  );
};

export default SuccessPage;
