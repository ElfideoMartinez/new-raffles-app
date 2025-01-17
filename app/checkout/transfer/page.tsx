"use client";
import useTicketStore from "@/app/store";
import { storage } from "@/app/firebaseconfig";
import React, { useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useRouter } from "next/navigation";

const CheckoutTransferPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentConceptKey] = useState(() =>
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join("")
  );
  const card = useTicketStore((state) => state.getItemsFromCart());
  //get first raffle id from the first raffle in the cart
  const raffleId = card[0]?.raffleId;
  const totalRafflePrice = card.reduce(
    (total, raffle) => total + (raffle.raffleTotalPrice || 0),
    0
  );
  const allTickets = card.flatMap((raffle) => raffle.ticketNumbers);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<any>(null);
  const ticketCount = 10;

  const copyToClipboard = (text: any) => {
    navigator.clipboard
      .writeText(text)
      .then(() => alert(`${text} copiado al portapapeles!`))
      .catch((error) => console.error("Error al copiar:", error));
  };

  const isPhoneValid = phone.length === 10 && /^\d+$/.test(phone);
  const isImageValid = image !== null;

  const handleImageChange = (e: any) => {
    setImage(e.target.files[0]);
  };

  return (
    <div className='flex flex-col items-center p-6 space-y-6 max-w-md mx-auto bg-white shadow-md rounded-lg'>
      <h2 className='text-black text-2xl font-bold'>
        Pago por Transferencia
      </h2>

      {/* General Explanation */}
      <div className='w-full p-4 text-sm text-gray-800 bg-blue-100 rounded-lg border border-blue-300'>
        <p>
          Para completar su compra, realice una transferencia bancaria al número
          de cuenta a continuación. Asegúrese de pegar la clave del concepto de
          pago en el campo del concepto de la transferencia.
        </p>
        <button
          onClick={() => copyToClipboard("1232392019203219")}
          className='mt-2 text-lg font-mono px-4 py-2 bg-gray-100 rounded-lg border border-gray-300 hover:bg-gray-200 active:bg-gray-300'
        >
          1232392019203219
        </button>
        <span className='text-sm text-gray-500 ml-2'>(Toca para copiar)</span>
      </div>

      {/* Conditional Verification Message */}
      {ticketCount > 5 && (
        <div className='w-full p-4 mb-4 text-sm text-yellow-800 bg-yellow-100 rounded-lg border border-yellow-400'>
          <p>
            Nota: Dado que está comprando más de 5 boletos, necesitará verificar
            su transferencia antes de que los boletos se confirmen como
            "vendidos".
          </p>
        </div>
      )}

      {/* Payment Concept Key */}
      <div className='flex flex-col items-center'>
        <p className='text-black text-lg font-semibold'>
          Clave del Concepto de Pago
        </p>
        <button
          onClick={() => copyToClipboard(paymentConceptKey)}
          className='mt-2 text-xl text-black font-mono px-4 py-2 bg-gray-100 rounded-lg border border-gray-300 hover:bg-gray-200 active:bg-gray-300'
        >
          {paymentConceptKey}
        </button>
        <span className='text-sm text-gray-500'>(Toca para copiar)</span>
      </div>

      {/* Phone Input with Copy Button */}
      <div className='flex flex-col items-center'>
        <label htmlFor='phone' className='text-black text-lg font-semibold'>
          Teléfono
        </label>
        <input
          id='phone'
          type='tel'
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className='mt-2 px-4 py-2 w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
          placeholder='Ingrese su número de teléfono'
        />
      </div>

      {/* Email Input (Optional) with Copy Button */}
      <div className='flex flex-col items-center'>
        <label htmlFor='email' className='text-black text-lg font-semibold'>
          Correo Electrónico (Opcional)
        </label>
        <input
          id='email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='mt-2 text-black px-4 py-2 w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='Ingrese su correo electrónico (opcional)'
        />
      </div>

      {/* Image Input */}
      <div className='flex flex-col items-center'>
        <label htmlFor='image' className='text-black text-lg font-semibold'>
          Subir Imagen
        </label>
        //add small desciption
        <p className='text-sm text-gray-500'>
          Suba una imagen de su comprobante de transferencia. puede ser una foto
          o captura de pantalla.
        </p>
        <input
          id='image'
          type='file'
          accept='image/*'
          onChange={handleImageChange}
          className='mt-2 px-4 py-2 w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {isImageValid && (
          <p className='text-sm text-green-600'>
            Imagen seleccionada: {image.name || "Ninguna"}
          </p>
        )}
      </div>

      <button
        onClick={async () => {
          if (isPhoneValid) {
            try {
              setIsLoading(true);
              const storageRef = ref(
                storage,
                `salesImages/${paymentConceptKey}`
              );
              await uploadBytes(storageRef, image as any);
              const downloadURL = await getDownloadURL(storageRef);
              const data = await fetch(
                `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/checkTransfer`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    phone,
                    email,
                    paymentConceptKey,
                    ticketCount,
                    raffle_id: raffleId,
                    totalSalePrice: totalRafflePrice,
                    ticketNumbers: allTickets,
                    paymentImage: downloadURL,
                  }),
                }
              );
              const result = await data.json();
              setIsLoading(false);
              //got to success page
              router.push("/checkout/success");
            } catch (error) {
              console.error("Error al completar la compra:", error);
              alert(
                "Error al completar la compra. Inténtalo de nuevo más tarde."
              );
              setIsLoading(false);
            }
          } else {
            alert(
              "Por favor, ingrese un número de teléfono válido de 10 dígitos."
            );
          }
        }}
        className={`px-4 py-2 mt-4 text-white bg-blue-500 rounded-lg hover:bg-blue-600 ${
          !(isPhoneValid && isImageValid) && "opacity-50 cursor-not-allowed"
        }`}
        disabled={!(isPhoneValid && isImageValid)}
      >
        {isLoading ? "Procesando..." : "Completar Compra"}
      </button>
    </div>
  );
};

export default CheckoutTransferPage;
