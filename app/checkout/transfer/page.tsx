"use client";
import { apiUrl } from "@/app/config/api";
import { useStorefrontConfig } from "@/app/config/storefrontConfig";
import useTicketStore from "@/app/store";
import { auth, storage } from "@/app/firebaseconfig";
import React, { useEffect, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useRouter } from "next/navigation";
import { toast } from "nextjs-toast-notify";

const CheckoutTransferPage = () => {
  const router = useRouter();
  // Bank account + notes are runtime-editable from /admin/config.
  const storefront = useStorefrontConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentConceptKey, setPaymenthConcept] = useState("");
  const raffles = useTicketStore((state) => state.getItemsFromCart());
  const bets = useTicketStore((state) => state.getBetsFromCart());
  //get first raffle id from the first raffle in the cart
  const raffleId = raffles[0]?.raffleId;
  const totalRafflePrice = raffles.reduce(
    (total, raffle) => total + (raffle.raffleTotalPrice || 0),
    0
  );
  const totalBetsPrice = bets.reduce(
    (total, bet) => total + (bet.totalPrice || 0), 0
  )
  console.log('Info de las rifas',raffles);
  const allTickets = raffles.map((raffle) => raffle.ticketNumbers.sort((a,b) => a-b)).flat().toString();
  const ticketCount = raffles.map((raffle) => raffle.ticketNumbers.sort((a, b) => a - b)).flat().length;
  //console.log("Num tickets", ticketCount);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<any>(null);
  const [total, setTotal] = useState(0);
  

  useEffect(()=>{
    const totalprice = totalRafflePrice+totalBetsPrice;
    setTotal(totalprice);
    setPaymenthConcept(() => Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join(""))
    //console.log('No. tickets: ',allTickets.length)
  },[])

  // function to set the type of payment
  const setPaymentMethod = useTicketStore((state) => state.setPaymentMethod);

  const copyToClipboard = (text: any) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.info(`${text} copiado al portapapeles!`,{
          duration: 2000,
          progress: false,
          position: 'top-right',
          transition: 'popUp',
          icon: '',
          sound: false,
        });
      })
      .catch((error) => console.error("Error al copiar:", error));
  };

  const removeAccents = (name: string): string => {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const handleName = (characterInput: string) => {
    const regexName = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    if(regexName.test(characterInput) || characterInput == '') return setName(removeAccents(characterInput));
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
      toast.warning(`El archivo seleccionado no es valido`,{
        duration: 2000,
        progress: false,
        position: 'top-right',
        transition: 'popUp',
        icon: '',
        sound: false,
      });
      return;
    }

    setImage(e.target.files[0]);
  };

  const isNameValid = name.length >= 5 && name.length < 50;
  const isPhoneValid = phone.length === 10;
  const isImageValid = image !== null;

  const emailRegex = /^[a-zA-Z0-9]+([._+-]?[a-zA-Z0-9-]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,10})+$/;
  //const emailRegex = /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/;
  const isEmailValid = emailRegex.test(email) && email.length < 50;

  return (
    <div className='flex flex-col items-center p-6 space-y-6 max-w-md mx-auto bg-white shadow-md rounded-card'>
      <h2 className='text-black text-2xl font-bold'>
        Pago por Transferencia
      </h2>
      
      {/* General Explanation */}
      <div className='w-full p-4 text-sm text-gray-800 bg-blue-100 rounded-card border border-blue-300'>       
        <p>
          Para completar tu compra, realiza una transferencia bancaria al número
          de cuenta a continuación. Asegúrate de pegar la clave del concepto de
          pago en el campo del concepto de la transferencia (opcional).
        </p>
        <div className="flex flex-col items-center justify-center sm:flex-row gap-2">
          <button
            onClick={() => copyToClipboard(storefront.bankAccount)}
            className='mt-2 text-lg font-mono px-4 py-2 bg-gray-100 rounded-sm border border-gray-300 hover:bg-gray-200 active:bg-gray-300'
          >
            {storefront.bankAccount}
          </button>
          <span className='text-sm text-gray-500'>(Toca para copiar)</span>
        </div>
        {(storefront.bankName || storefront.bankHolder) && (
          <p className='mt-2 text-sm text-gray-700 text-center'>
            {storefront.bankName ? <>Banco: {storefront.bankName}<br/></> : null}
            {storefront.bankHolder ? <>Titular: {storefront.bankHolder}</> : null}
          </p>
        )}
        {storefront.bankNote ? (
          <p className='mt-2 text-sm text-gray-700 text-center whitespace-pre-line'>
            {storefront.bankNote}
          </p>
        ) : null}
        <h1 className='text-black text-xl font-bold text-center mt-2'>
          Monto total ${total}
        </h1>
      </div>

      {/* Conditional Verification Message */}
      {ticketCount > 5 && (
        <div className='w-full p-4 mb-4 text-sm text-yellow-800 bg-yellow-100 rounded-card border border-yellow-400'>
          <p>
            Nota: Dado que estás comprando más de 5 boletos, se necesitará verificar
            tu transferencia antes de que los boletos se confirmen como
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
          className='mt-2 text-xl text-black font-mono px-4 py-2 bg-gray-100 rounded-sm border border-gray-300 hover:bg-gray-200 active:bg-gray-300'
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
          className='mt-2 px-4 py-2 w-full border rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-950'
          placeholder='Ingresa tu nombre completo'
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
          className='mt-2 px-4 py-2 w-full border rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-950'
          placeholder='Ingresa tu número de teléfono'
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
          className='mt-2 bg-white text-gray-950 px-4 py-2 w-full border rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          placeholder='Ingresa tu correo electrónico (opcional)'
        />
      </div>

      {/* Image Input */}
      <div className='flex flex-col items-center'>
        <label htmlFor='image' className='text-black text-lg font-semibold'>
          Subir Imagen
        </label>
        {/* add small description */}
        <p className='text-sm text-gray-500'>
          Sube una imagen de tu comprobante de transferencia. Puede ser una
          foto o captura de pantalla.
        </p>
        <input
          id='image'
          type='file'
          accept='image/*'
          onChange={handleImageChange}
          className='mt-2 px-4 py-2 w-full border rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
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
              
              // The sale is created by the server (createTransferSale), which
              // recomputes the totals, checks the tickets are still available
              // and decides `verified`. The client only sends the contact
              // details, the cart and the receipt image. The ID token is
              // optional: it is sent when a customer happens to be signed in
              // so the sale can be linked to their account.
              const user = auth.currentUser;
              const idToken = user ? await user.getIdToken() : null;
              const res = await fetch(apiUrl("createTransferSale"), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                },
                body: JSON.stringify({
                  name,
                  phone,
                  email,
                  paymentConceptKey,
                  raffles,
                  bets,
                  paymentImage: downloadURL,
                }),
              });
              const result = await res.json().catch(() => null);
              if (!res.ok) {
                throw new Error(
                  (result && typeof result.message === "string" && result.message) ||
                    "No pudimos registrar tu compra."
                );
              }
              setIsLoading(false);
              setPaymentMethod("transfer");

              // Only a confirmed server write moves the customer on.
              router.push("/checkout/success");
            } catch (error) {
              console.error("Error al completar la compra:", error);
              const detail =
                error instanceof Error && error.message
                  ? error.message
                  : "Inténtalo de nuevo más tarde.";
              toast.error(`No pudimos registrar tu compra. ${detail}`,{
                duration: 2000,
                progress: false,
                position: 'top-right',
                transition: 'popUp',
                icon: '',
                sound: false,
              });
              setIsLoading(false);
            }
          } else {
            toast.warning(`Por favor, ingresa un número de teléfono válido de 10 dígitos`,{
              duration: 2000,
              progress: false,
              position: 'top-right',
              transition: 'popUp',
              icon: '',
              sound: false,
            });
          }
        }}
        className={`px-4 py-2 mt-4 text-white bg-blue-500 rounded-pill hover:bg-blue-600 ${
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
