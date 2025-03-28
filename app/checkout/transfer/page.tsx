"use client";
import useTicketStore from "@/app/store";
import { storage } from "@/app/firebaseconfig";
import React, { useEffect, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useRouter } from "next/navigation";

const CheckoutTransferPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentConceptKey, setPaymenthConcept] = useState("");
  const raffles = useTicketStore((state) => state.getItemsFromCart());
  //get first raffle id from the first raffle in the cart
  const raffleId = raffles[0]?.raffleId;
  const totalRafflePrice = raffles.reduce(
    (total, raffle) => total + (raffle.raffleTotalPrice || 0),
    0
  );
  
  const allTickets = raffles.map((raffle) => raffle.ticketNumbers.sort((a,b) => a-b)).flat().toString();
  console.log(allTickets);
  //const allTickets = raffles.flatMap((raffle) => raffle.ticketNumbers);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const ticketCount = allTickets.length; 
  //console.log(allTickets);

  useEffect(()=>{
    setTotal(totalRafflePrice);
    setPaymenthConcept(() => Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join(""))
  },[])

  // function to set the type of payment
  const setPaymentMethod = useTicketStore((state) => state.setPaymentMethod);

  const copyToClipboard = (text: any) => {
    navigator.clipboard
      .writeText(text)
      .then(() => alert(`${text} copiado al portapapeles!`))
      .catch((error) => console.error("Error al copiar:", error));
  };

  const handleName = (characterInput: string) => {
    const regexName = /^[A-Za-z\s]+$/;
    if(regexName.test(characterInput) || characterInput == '') return setName(characterInput);
  }

  const handlePhone = (numberInput: string) => {
    if(/^\d+$/.test(numberInput) || numberInput == '') return setPhone(numberInput);
  }

  const handleImageChange = (e: any) => {

    const file = e.target.files[0];
    if(!file) return;

    // validate file extension
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase ();
    const validExtension = ["jpg", "jpeg", "png", "heic", "heif", "webp", "jfif"];

    if (!fileExtension || !validExtension.includes(fileExtension)){
      alert('El archivo seleccionado no es valido');
      return;
    }

    setImage(e.target.files[0]);
  };

  const isNameValid = name.length >= 5 && name.length < 50;
  const isPhoneValid = phone.length === 10;
  const isImageValid = image !== null;

  const emailRegex = /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/;
  const isEmailValid = emailRegex.test(email);

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
          pago en el campo del concepto de la transferencia (opcional).
        </p>
        <div className="flex flex-col items-center justify-center sm:flex-row gap-2">
          <button
            onClick={() => copyToClipboard("4152314380833197")}
            className='mt-2 text-lg font-mono px-4 py-2 bg-gray-100 rounded-lg border border-gray-300 hover:bg-gray-200 active:bg-gray-300'
          >
            4152314380833197
          </button>
          <span className='text-sm text-gray-500'>(Toca para copiar)</span>
        </div>
        <h1 className='text-black text-xl font-bold text-center mt-2'>
          Monto total ${total}
        </h1>
      </div>

      {/* Conditional Verification Message */}
      {ticketCount > 10000000 && (
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

      <div className='flex flex-col items-center'>
        <label htmlFor='phone' className='text-black text-lg font-semibold'>
          Nombre
        </label>
        <input
          id='name'
          type='text'
          value={name}
          onChange={(e) => handleName(e.target.value)}
          className='mt-2 px-4 py-2 w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
          placeholder='Ingrese su nombre completo'
        />
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
          onChange={(e) => handlePhone(e.target.value)}
          className='mt-2 px-4 py-2 w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
          placeholder='Ingrese su número de teléfono'
        />
      </div>

      {/* Email Input (Optional) with Copy Button */}
      <div className='flex flex-col items-center'>
        <label htmlFor='email' className='text-black text-lg font-semibold'>
          Correo Electrónico
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
                //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/checkTransfer`,
                `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/checkTransfer`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    name,
                    phone,
                    email,
                    paymentConceptKey,
                    ticketCount,
                    allTickets,
                    raffles,
                    totalSalePrice: totalRafflePrice,                    
                    paymentImage: downloadURL,
                  }),
                }
              );
              const result = await data.json();
              setIsLoading(false);
              setPaymentMethod("transfer");

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
          !(isPhoneValid && isImageValid && isEmailValid && isNameValid) && "opacity-50 cursor-not-allowed"
        }`}
        disabled={!(isPhoneValid && isImageValid && isEmailValid && isNameValid)}
      >
        {isLoading ? "Procesando..." : "Completar Compra"}
      </button>
    </div>
  );
};

export default CheckoutTransferPage;
