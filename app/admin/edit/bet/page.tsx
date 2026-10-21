"use client";

import { apiUrl } from "@/app/config/api";
import DeleteRaffleModal from "@/app/components/DeleteRaffleModal";
import WithAuth from "@/app/components/WithAuth";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { toast } from "nextjs-toast-notify";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { FadeLoader } from "react-spinners";

interface IBetData {
  id: string;
  title: string;
}

const EditBetPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBet, setIsLoadingBet] = useState(false);
  const [isFinishedBet, setIsFinishedBet] = useState(false);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [idBet, setIdBet] = useState("");
  const [betsData, setBetsData] = useState<IBetData[]>([]);
  const [updatedBetsData, setUpdatedBetsData] = useState(false);
  const [bet, setBet] = useState({
    title: "",
    description: "",
    image: "",
    date: "",
    pricePerTicket: "",
    initialPool: "",
    teams: ["", ""],
    betsTeamA: 0,
    betsTeamB: 0,
    isFinished: false,
  });

  useEffect(() => {
    setIdBet("default");
    const fetchBetData = async () => {
      try {
        const response = await fetch(
          //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getAllBets`,
          apiUrl("getAllBets"),
          { cache: "no-store" }
        );

        if (!response.ok) {
          console.log(response);
          throw new Error("Failed to fetch raffle data");
        }

        const data = await response.json();
        const bets = data.result.map(
          ({ id, title }: { id: string; title: string }) => ({
            id,
            title,
          })
        );
        setBetsData(bets);
      } catch (e) {
        console.error("Error: ", e);
      }
    };
    fetchBetData();
  }, [updatedBetsData]);

  const handleChange = (e: React.ChangeEvent<any>) => {
    const { name, value } = e.target;

    setBet({
      ...bet,
      [name]: value,
    });
  };

  const handleTeamChange = (index: number, value: string) => {
    const newTeams = [...bet.teams];
    newTeams[index] = value;
    setBet({
      ...bet,
      teams: newTeams,
    });
    console.log(bet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const downloadURL = await uploadBetImage(newImage as any, bet.title);
    if (downloadURL != "") bet.image = downloadURL;

    try {
      const result = await fetch(
        //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/updateBet`,
        apiUrl("updateBet"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idBet, bet }),
        }
      );

      if (!result.ok) {
        console.log(result);
        throw new Error(result.statusText);
      }
    } catch (e) {
      console.log(e);
    }
    setIsLoading(false);
    cleanBet();
    setNewImage(null);
    resetForm();
    toast.success(`Apuesta actualizada correctamente`, {
      duration: 2000,
      progress: false,
      position: "top-right",
      transition: "popUp",
      icon: "",
      sound: false,
    });
    setUpdatedBetsData((prev) => !prev);
  };

  const uploadBetImage = async (file: File, betId: string) => {
    const storage = getStorage();
    const storageRef = ref(storage, `betImages/${betId}`);

    if (newImage != null) {
      try {
        await deleteObject(storageRef);
        console.log("Previous image deleted");
      } catch (error) {
        console.log("Previous image not found, or error deleting it", error);
      }

      const snapshot = await uploadBytes(storageRef, file);
      console.log("A new file has been uploaded!", snapshot);

      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    }
    return "";
  };

  const handleFileChange = (e: any) => {
    const fileImage = e.target.files[0];
    setNewImage(fileImage);
  };

  const handleChangeRaffle = async (id: string) => {
    if (id == "default") {
      setIdBet(id);
      cleanBet();
      return;
    }
    setIsLoadingBet(true);
    setIdBet(id);
    try {
      const responseData = await fetch(
        //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getBetData`,
        apiUrl("getBetData"),
        {
          cache: "no-store",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id }),
        }
      );
      if (!responseData.ok) {
        console.error(responseData);
        throw new Error("Failed to fetch raffle data");
      }
      const result = await responseData.json();
      console.log(result);

      setBet((prevBet) => ({
        ...prevBet,
        title: result.betData.title || "",
        description: result.betData.description || "",
        image: result.betData.image || "",
        date: result.betData.date || "",
        pricePerTicket: result.betData.pricePerTicket || "",
        initialPool: result.betData.initialPool || "",
        teams: result.betData.teams || [],
        betsTeamA: result.betData.betsTeamA || 0,
        betsTeamB: result.betData.betsTeamB || 0,
        isFinished: result.betData.isFinished || false,
      }));
      setIsLoadingBet(false);
    } catch (e) {
      console.log(e);
    }
  };

  const handleDeleteRaffle = async () => {
    try {
      const result = await fetch(
        //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/deleteBet`,
        apiUrl("deleteBet"),
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idBet }),
        }
      );

      if (!result.ok) {
        console.log(result);
        throw new Error(result.statusText);
      }
    } catch (e) {
      console.error(e);
    }
    toast.success(`Apuesta borrada correctamente`, {
      duration: 2000,
      progress: false,
      position: "top-right",
      transition: "popUp",
      icon: "",
      sound: false,
    });
    cleanBet();
    resetForm();
    setTimeout(() => {
      setUpdatedBetsData((prev) => !prev);
    }, 1000);
  };

  const handleChangeFinish = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setBet((prevBet) => ({
      ...prevBet,
      isFinished: checked,
    }));
  };

  const cleanBet = () =>
    setBet({
      title: "",
      description: "",
      image: "",
      date: "",
      pricePerTicket: "",
      initialPool: "",
      teams: ["", ""],
      betsTeamA: 0,
      betsTeamB: 0,
      isFinished: false,
    });

  const isFormValid = useMemo(() => {
    const areStringsValid =
      bet.title.trim() !== "" &&
      bet.description.trim() !== "" &&
      String(bet.image ?? "").trim() !== "" &&
      bet.date.trim() !== "" &&
      bet.pricePerTicket.trim() !== "";
    //bet.initialPool.trim() !== "";

    const areTeamsValid =
      bet.teams.length === 2 &&
      bet.teams[0].trim() !== "" &&
      bet.teams[1].trim() !== "";

    return areStringsValid && areTeamsValid;
  }, [bet]);

  const formRef = useRef<HTMLFormElement>(null);
  const resetForm = () => {
    formRef.current?.reset();
  };

  const isValidBet = idBet != "default";
  console.log("Rifa valida:", isValidBet);

  return (
    <div className='max-w-lg mx-auto bg-white p-6 rounded-lg shadow-lg mt-5'>
      <h2 className='text-black text-2xl font-bold mb-6 text-center'>
        Actualizar apuesta
      </h2>
      <form ref={formRef} onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Apuestas disponibles:
          </label>
          <select
            className='w-full py-2 px-3 text-gray-950 bg-white border rounded-lg focus:border-blue-500'
            onChange={(e) => handleChangeRaffle(e.target.value)}
          >
            <option value={"default"}>Selecciona una apuesta</option>
            {betsData.map((bet) => (
              <option key={bet.id} value={bet.id}>
                {bet.title}
              </option>
            ))}
          </select>
        </div>
        {isLoadingBet ? (
          <div className='flex justify-center pt-2'>
            <FadeLoader color="var(--color-ink-900)" />
          </div>
        ) : (
          <div>
            <div>
              <label className='text-black block text-sm font-medium mb-1'>
                Titulo de la Apuesta:
              </label>
              <input
                type='text'
                name='title'
                value={bet.title}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-black block text-sm font-medium mb-1'>
                Descripcion de la apuesta:
              </label>
              <textarea
                name='description'
                value={bet.description}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div>

            <div>
              <label className='text-black block text-sm font-medium mb-1'>
                Precio por Ticket:
              </label>
              <input
                type='number'
                name='pricePerTicket'
                value={bet.pricePerTicket}
                onChange={handleChange}
                required
                step='0.01'
                min='0'
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-black block text-sm font-medium mb-1'>
                Fecha de Sorteo:
              </label>
              <input
                type='date'
                name='date'
                value={bet.date}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div>
            <div className='mt-2'>
              <label className='text-black block text-sm font-medium mb-1'>
                Pozo inicial/actual:
              </label>
              <input
                type='number'
                name='initialPool'
                value={bet.initialPool}
                onChange={handleChange}
                required
                min={0}
                step='0.01'
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-black block text-sm font-medium mb-1'>
                Equipo A:
              </label>
              <input
                type='text'
                name='teamA'
                value={bet.teams[0]}
                onChange={(e) => handleTeamChange(0, e.target.value)}
                required
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-black block text-sm font-medium mb-1'>
                Equipo B
              </label>
              <input
                type='text'
                name='teamB'
                value={bet.teams[1]}
                onChange={(e) => handleTeamChange(1, e.target.value)}
                required
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div>

            <div className='flex flex-col gap-4 py-4'>
              <label className='flex items-center gap-2 text-gray-950'>
                <input
                  type='checkbox'
                  checked={bet.isFinished}
                  onChange={handleChangeFinish}
                  className='accent-blue-600 h-5 w-5'
                />
                Apuesta cerrada
              </label>
            </div>

            <div>
              <label className='text-black block text-sm font-medium mb-1'>
                Actualizar imagen de la apuesta:
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
              {bet.image ? "Imagen cargada" : "Cargar imagen de la apuesta"}
            </p>
            <div className='mt-3'>
              <label className='text-black mb-1'>Imagen Actual</label>
              <img src={bet.image} alt='imagen actual de la apuesta' />
            </div>
          </div>
        )}

        <div
          className={`flex gap-1 ${
            !isValidBet ? "opacity-50 cursor-none" : ""
          }`}
        >
          <button
            disabled={isLoading || !isValidBet}
            type='submit'
            className={`w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold 
              hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50
              `}
          >
            {isLoading ? "Actualizando..." : "Actualizar apuesta"}
          </button>
          <DeleteRaffleModal
            idRaffle={idBet}
            isAvailable={!isValidBet}
            onDelete={handleDeleteRaffle}
          />
        </div>
      </form>
    </div>
  );
};

export default WithAuth(EditBetPage);
