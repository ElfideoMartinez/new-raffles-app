"use client";
import withAuth from "@/app/components/WithAuth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import Link from "next/link";
import React, { useState } from "react";

interface IRaffle {
  title: string;
  date: string;
  numberOfTickets: string;
  pricePerTicket: string;
  awardName: string;
  awardDescription: string;
  awardImage: string;
}

const CreateRaffle = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [raffle, setRaffle] = useState({
    title: "",
    date: "",
    numberOfTickets: "",
    pricePerTicket: "",
    awardName: "",
    awardDescription: "",
    awardImage: "",
  });

  const handleChange = (e: React.ChangeEvent<any>) => {
    const { name, value } = e.target;
    setRaffle({
      ...raffle,
      [name]: value,
    });
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setRaffle({
      ...raffle,
      awardImage: file,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    //get the form data
    const formData = new FormData();
    formData.append("name", raffle.title);
    formData.append("date", raffle.date);
    formData.append("numberOfTickets", raffle.numberOfTickets);
    formData.append("pricePerTicket", raffle.pricePerTicket);
    formData.append("awardName", raffle.awardName);
    formData.append("description", raffle.awardDescription);
    const downloadURL = await uploadRaffleImage(
      raffle.awardImage as any,
      raffle.title
    );
    formData.append("awardImage", downloadURL);

    // Convert FormData to a plain object
    const plainObject: { [key: string]: string | File } = Object.fromEntries(formData.entries());

    // Crear el objeto con la interfaz IRaffle
    const raffleData: IRaffle = {
      title: plainObject.name as string,
      date: plainObject.date as string,
      numberOfTickets: plainObject.numberOfTickets as string,
      pricePerTicket: plainObject.pricePerTicket as string,
      awardName: plainObject.awardName as string,
      awardDescription: plainObject.description as string,
      awardImage: plainObject.awardImage as string,
    };

    console.log("Objeto Plano",raffleData);
    createNewRaffle(raffleData);
    setIsLoading(false);
    alert("Rifa creada exitosamente");
  };
  const uploadRaffleImage = async (file: File, raffleId: string) => {
    const storage = getStorage();
    const storageRef = ref(storage, `raffleImages/${raffleId}`);

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    console.log("Uploaded a blob or file!", snapshot);

    // Get and return the download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };
  const createNewRaffle = async (raffle: IRaffle) => {

    const raffleData = {
      ...raffle,
    }

    const res = await fetch(
      //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/createRaffle`,
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/createRaffle`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(raffleData),
      }
    );
    if (!res.ok) {
      console.log(res);
      throw new Error(res.statusText);
    }
    const data = await res.json();
    console.log(data);
    return data;
  };

  return (
    <div className='max-w-lg mx-auto bg-white p-6 rounded-lg shadow-lg mt-5'>
      <h2 className='text-black text-2xl font-bold mb-6 text-center'>
        Crear nueva rifa
      </h2>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Titulo de la Rifa:
          </label>
          <input
            type='text'
            name='title'
            value={raffle.title}
            onChange={handleChange}
            required
            className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500'
          />
        </div>

        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Numero de Tickets (Boletos):
          </label>
          <input
            type='number'
            name='numberOfTickets'
            value={raffle.numberOfTickets}
            onChange={handleChange}
            required
            min='1'
            className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500'
          />
        </div>

        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Precio por Ticket:
          </label>
          <input
            type='number'
            name='pricePerTicket'
            value={raffle.pricePerTicket}
            onChange={handleChange}
            required
            step='0.01'
            min='0'
            className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500'
          />
        </div>

        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Nombre del Premio:
          </label>
          <input
            type='text'
            name='awardName'
            value={raffle.awardName}
            onChange={handleChange}
            required
            className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500'
          />
        </div>

        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Descripcion del Premio:
          </label>
          <textarea
            name='awardDescription'
            value={raffle.awardDescription}
            onChange={handleChange}
            required
            className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500'
          />
        </div>
        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Fecha de Sorteo:
          </label>
          <input
            type='date'
            name='date'
            value={raffle.date}
            onChange={handleChange}
            required
            className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500'
          />
        </div>
        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Imagen del Premio:
          </label>
          <input
            type='file'
            name='awardImage'
            onChange={handleFileChange}
            accept='image/*'
            className='w-full text-black'
          />
        </div>
        <p className='text-sm text-green-600'>
          {raffle.awardImage ? "Imagen cargada" : "Cargar imagen del premio"}
        </p>
        <button
          disabled={isLoading}
          type='submit'
          className='w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50'
        >
          {isLoading ? "Creating..." : "Crear Rifa"}
        </button>
      </form>
    </div>
  );
};

export default withAuth(CreateRaffle);
