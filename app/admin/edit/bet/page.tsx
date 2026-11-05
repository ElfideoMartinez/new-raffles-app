"use client";

import { apiUrl, authedApiFetch } from "@/app/config/api";
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

/** Normalise whatever the API returned into a strict [a, b] string tuple.
 *
 * The API returns teams as {a,b}; very old records may hold an array. The form
 * indexes teams[0]/teams[1] and calls .trim() on them during render, so ANY
 * non-string element (null, number, undefined) used to throw inside the render
 * and white-screen /admin/edit/bet. Coerce here, once, so the render can never
 * see a non-string.
 */
function toTeamTuple(teams: unknown): [string, string] {
  if (Array.isArray(teams)) {
    return [
      typeof teams[0] === "string" ? teams[0] : "",
      typeof teams[1] === "string" ? teams[1] : "",
    ];
  }
  if (teams && typeof teams === "object") {
    const t = teams as { a?: unknown; b?: unknown };
    return [typeof t.a === "string" ? t.a : "", typeof t.b === "string" ? t.b : ""];
  }
  return ["", ""];
}

/** Safe string read for inputs that must never receive null/undefined. */
function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

const EditBetPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBet, setIsLoadingBet] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    teams: ["", ""] as [string, string],
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
    setBet((prev) => {
      const next: [string, string] = [
        asString(prev.teams[0]),
        asString(prev.teams[1]),
      ];
      next[index] = value;
      return { ...prev, teams: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const downloadURL = await uploadBetImage(newImage as any, bet.title);
    if (downloadURL != "") bet.image = downloadURL;

    try {
      const result = await authedApiFetch("updateBet", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          // Send teams back in the canonical {a,b} shape and omit server-owned
          // odds/counters. updateBet merges, so anything omitted is preserved.
          body: JSON.stringify({
            idBet,
            bet: {
              ...bet,
              teams: { a: bet.teams[0] || "", b: bet.teams[1] || "" },
            },
          }),
        }
      );

      if (!result.ok) {
        console.error("updateBet failed:", result.status, result.statusText);
        throw new Error(
          `updateBet failed with status ${result.status}: ${result.statusText}`
        );
      }
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
    } catch (e) {
      console.error("Error al actualizar la apuesta:", e);
      toast.error(`Error al actualizar la apuesta. Inténtalo de nuevo.`, {
        duration: 2000,
        progress: false,
        position: "top-right",
        transition: "popUp",
        icon: "",
        sound: false,
      });
    } finally {
      setIsLoading(false);
    }
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
      setLoadError(null);
      cleanBet();
      return;
    }
    setIsLoadingBet(true);
    setLoadError(null);
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

      const d = result?.betData ?? {};
      setBet((prevBet) => ({
        ...prevBet,
        title: asString(d.title),
        description: asString(d.description),
        image: asString(d.image),
        date: asString(d.date),
        pricePerTicket: asString(d.pricePerTicket),
        initialPool: asString(d.initialPool),
        // Always a [string, string]; the UI indexes and .trim()s it.
        teams: toTeamTuple(d.teams),
        betsTeamA: Number(d.betsTeamA) || 0,
        betsTeamB: Number(d.betsTeamB) || 0,
        isFinished: d.isFinished === true,
      }));
    } catch (e) {
      console.error("Could not load bet for editing:", e);
      // Without this the form silently keeps the previous bet's values while
      // the select shows the new one — worse than an error.
      setLoadError(
        "No se pudo cargar la apuesta seleccionada. Inténtalo de nuevo."
      );
    } finally {
      // Always clear the spinner. It used to be set true and never reset,
      // which is why choosing a bet left the page stuck on the loader.
      setIsLoadingBet(false);
    }
  };

  const handleDeleteRaffle = async () => {
    try {
      const result = await authedApiFetch("deleteBet", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idBet }),
        }
      );

      if (!result.ok) {
        console.error("deleteBet failed:", result.status, result.statusText);
        throw new Error(
          `deleteBet failed with status ${result.status}: ${result.statusText}`
        );
      }
    } catch (e) {
      console.error(e);
      toast.error(`Error al borrar la apuesta. Inténtalo de nuevo.`, {
        duration: 2000,
        progress: false,
        position: "top-right",
        transition: "popUp",
        icon: "",
        sound: false,
      });
      return;
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
      teams: ["", ""] as [string, string],
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
      asString(bet.teams[0]).trim() !== "" &&
      asString(bet.teams[1]).trim() !== "";

    return areStringsValid && areTeamsValid;
  }, [bet]);

  const formRef = useRef<HTMLFormElement>(null);
  const resetForm = () => {
    formRef.current?.reset();
  };

  const isValidBet = idBet != "default";
  console.log("Rifa valida:", isValidBet);

  return (
    <div className='max-w-lg mx-auto bg-surface p-6 rounded-card shadow-lg mt-5'>
      <h2 className='text-ink-900 text-2xl font-bold mb-6 text-center'>
        Actualizar apuesta
      </h2>
      <form ref={formRef} onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label className='text-ink-900 block text-sm font-medium mb-1'>
            Apuestas disponibles:
          </label>
          <select
            className='w-full py-2 px-3 text-ink-900 bg-surface border rounded-sm focus:border-brand-500'
            value={idBet || "default"}
            disabled={isLoadingBet}
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
        {loadError && (
          <p className='text-sm text-danger-700 bg-danger-50 border border-danger-500 rounded-card p-3'>
            {loadError}
          </p>
        )}

        {isLoadingBet ? (
          <div className='flex justify-center pt-2'>
            <FadeLoader color="var(--color-ink-900)" />
          </div>
        ) : (
          <div>
            <div>
              <label className='text-ink-900 block text-sm font-medium mb-1'>
                Titulo de la Apuesta:
              </label>
              <input
                type='text'
                name='title'
                value={bet.title}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-ink-900 block text-sm font-medium mb-1'>
                Descripcion de la apuesta:
              </label>
              <textarea
                name='description'
                value={bet.description}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500'
              />
            </div>

            <div>
              <label className='text-ink-900 block text-sm font-medium mb-1'>
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
                className='w-full px-4 py-2 border rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-ink-900 block text-sm font-medium mb-1'>
                Fecha de Sorteo:
              </label>
              <input
                type='date'
                name='date'
                value={bet.date}
                onChange={handleChange}
                required
                className='w-full px-4 py-2 border rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500'
              />
            </div>
            <div className='mt-2'>
              <label className='text-ink-900 block text-sm font-medium mb-1'>
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
                className='w-full px-4 py-2 border rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-ink-900 block text-sm font-medium mb-1'>
                Equipo A:
              </label>
              <input
                type='text'
                name='teamA'
                value={asString(bet.teams[0])}
                onChange={(e) => handleTeamChange(0, e.target.value)}
                required
                className='w-full px-4 py-2 border rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500'
              />
            </div>

            <div className='mt-2'>
              <label className='text-ink-900 block text-sm font-medium mb-1'>
                Equipo B
              </label>
              <input
                type='text'
                name='teamB'
                value={asString(bet.teams[1])}
                onChange={(e) => handleTeamChange(1, e.target.value)}
                required
                className='w-full px-4 py-2 border rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500'
              />
            </div>

            <div className='flex flex-col gap-4 py-4'>
              <label className='flex items-center gap-2 text-ink-900'>
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
              <label className='text-ink-900 block text-sm font-medium mb-1'>
                Actualizar imagen de la apuesta:
              </label>
              <input
                type='file'
                name='awardImage'
                onChange={handleFileChange}
                accept='image/*'
                className='w-full text-ink-900'
              />
            </div>
            <p className='text-sm text-success-700'>
              {bet.image ? "Imagen cargada" : "Cargar imagen de la apuesta"}
            </p>
            <div className='mt-3'>
              <label className='text-ink-900 mb-1'>Imagen Actual</label>
              <img src={bet.image} alt='imagen actual de la apuesta' />
            </div>
          </div>
        )}

        <div
          className={`flex gap-1 ${
            !isValidBet ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <button
            disabled={isLoading || !isValidBet}
            type='submit'
            className={`w-full bg-brand-600 text-white py-2 px-4 rounded-card font-semibold 
              hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50
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
