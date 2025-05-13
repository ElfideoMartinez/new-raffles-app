"use client";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import useTicketStore from "@/app/store";
const SuccessPage = () => {
  const raffles = useTicketStore((state) => state.getItemsFromCart());
  const cleanCart = useTicketStore((state) => state.cleanCart);
  const cleanSelected = useTicketStore((state) => state.clearSelectedTickets);
  const paymentMethod = useTicketStore((state) => state.paymentMethod);

  const [isHydrated, setIsHydrated] = useState(false);

  console.log("Tickets", raffles);
  useEffect(() => {
    // if(paymentMethod !== "transfer"){
    //   markAsSold();
    // }
    cleanCart();
    console.log("cleaning cart from outside");
    cleanSelected();
    setIsHydrated(true);
  }, []);

  const markAsSold = async () => {
    const promises = raffles.map((raffle) =>
      fetch(`https://us-central1-raffleapp-dbc1b.cloudfunctions.net/success`, {
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

  const isTransfer = isHydrated && paymentMethod === 'transfer';

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
      {isTransfer ? 
        <div>
          <p>Ojo 👀 <br></br>Como tu pago fue por transferencia, tus boletos comprados seguiran apareciendo como disponibles,<br></br> 
          una vez verificada tu transferencia te lo haremos saber por medio de whatsapp y tus boletos apareceran como vendidos.</p>
        </div> 
      : '' }
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
