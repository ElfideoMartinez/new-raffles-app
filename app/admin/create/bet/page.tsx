"use client";
import { authedApiFetch } from "@/app/config/api";
import WithAuth from "@/app/components/WithAuth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { toast } from "nextjs-toast-notify";
import { useMemo, useRef, useState, useCallback } from "react";

interface IBet {
  title: string;
  description: string;
  image: string;
  date: string;
  pricePerTicket: number;
  teams: {
    a: string;
    b: string;
  };
  oddsTeamA: string;
  oddsTeamB: string;
  oddsTie?: string | undefined;
  totalBets: number;
}

interface BetFormData {
  title: string;
  description: string;
  image: File | null;
  date: string;
  pricePerTicket: number;
  teams: {
    a: string;
    b: string;
  };
  oddsTeamA: string;
  oddsTeamB: string;
  oddsTie?: string | undefined;
}

// Quick price options so a new bet starts with sensible values instead of 0.
// (The pool is pari-mutuel — payout is computed at settlement — so these are
// ticket-price options, not pre-set payout returns.)
const PRICE_PRESETS = [20, 50, 100, 200, 500];

const CreateBet = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [bet, setBet] = useState<BetFormData>({
    title: "",
    description: "",
    image: null,
    date: "",
    pricePerTicket: 0,
    teams: { a: "", b: "" },
    oddsTeamA: "",
    oddsTeamB: "",
    oddsTie: undefined, // Initialize tie odds as undefined
  });

  const formRef = useRef<HTMLFormElement>(null);

  // Optimized change handlers using useCallback
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setBet((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    []
  );

  const handleTeamChange = useCallback((team: "a" | "b", value: string) => {
    setBet((prev) => ({
      ...prev,
      teams: {
        ...prev.teams,
        [team]: value,
      },
    }));
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setBet((prev) => ({
        ...prev,
        image: file,
      }));
    },
    []
  );

  const uploadBetImage = useCallback(async (file: File, betTitle: string) => {
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `betImages/${betTitle}_${Date.now()}`);

      const snapshot = await uploadBytes(storageRef, file);

      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Failed to upload image");
    }
  }, []);

  const createNewBet = useCallback(async (betData: IBet) => {
    try {
      const res = await authedApiFetch("createBet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(betData),
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Error creating bet:", error);
      throw error;
    }
  }, []);

  const resetForm = useCallback(() => {
    formRef.current?.reset();
    setBet({
      title: "",
      description: "",
      image: null,
      date: "",
      pricePerTicket: 0,
      teams: { a: "", b: "" },
      oddsTeamA: "",
      oddsTeamB: "",
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!bet.image) {
        toast.error("Por favor selecciona una imagen para la apuesta", {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
        return;
      }

      setIsLoading(true);

      try {
        const imageUrl = await uploadBetImage(bet.image, bet.title);
        // Prepare bet data
        const betData: IBet = {
          title: bet.title.trim(),
          description: bet.description.trim(),
          date: bet.date,
          pricePerTicket: bet.pricePerTicket,
          image: imageUrl,
          teams: {
            a: bet.teams.a.trim(),
            b: bet.teams.b.trim(),
          },
          oddsTeamA: bet.oddsTeamA.trim(),
          oddsTeamB: bet.oddsTeamB.trim(),
          oddsTie: bet.oddsTie?.trim() || undefined,
          totalBets: 0,
        };

        await createNewBet(betData);

        //un comment this to clear form after submission
        // resetForm();
        toast.success("Apuesta creada exitosamente", {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
      } catch (error) {
        console.error("Error in form submission:", error);
        toast.error("Error al crear la apuesta. Inténtalo de nuevo.", {
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
    },
    [bet, uploadBetImage, createNewBet, resetForm]
  );

  // Optimized form validation
  const isFormValid = useMemo(() => {
    const areStringFieldsValid =
      bet.title.trim() !== "" &&
      bet.description.trim() !== "" &&
      bet.date.trim() !== "" &&
      bet.pricePerTicket !== 0;

    const areTeamsValid =
      bet.teams.a.trim() !== "" && bet.teams.b.trim() !== "";

    const isPriceValid = !isNaN(bet.pricePerTicket) && bet.pricePerTicket > 0;

    const hasImage = bet.image !== null;

    return areStringFieldsValid && areTeamsValid && isPriceValid && hasImage;
  }, [bet]);

  return (
    <div className='min-h-screen bg-surface py-8 px-4'>
      <div className='max-w-2xl mx-auto'>
        {/* Header */}
        <div className='bg-surface rounded-t-card p-6 border-b border-ink-100 shadow-card'>
          <h2 className='text-ink-900 text-3xl font-bold text-center'>
            Crear Nueva Apuesta
          </h2>
          <p className='text-ink-500 text-center mt-2'>
            Completa todos los campos para crear una nueva apuesta
          </p>
        </div>

        {/* Form */}
        <div className='bg-surface rounded-b-card p-6 shadow-card border border-t-0 border-ink-100'>
          <form ref={formRef} onSubmit={handleSubmit} className='space-y-6'>
            {/* Title */}
            <div>
              <label className='text-ink-700 block text-sm font-medium mb-2'>
                Título de la Apuesta *
              </label>
              <input
                type='text'
                name='title'
                value={bet.title}
                onChange={handleChange}
                required
                placeholder='Ej: Real Madrid vs Barcelona'
                className='w-full px-4 py-3 border border-ink-300 rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all'
              />
            </div>

            {/* Description */}
            <div>
              <label className='text-ink-700 block text-sm font-medium mb-2'>
                Descripción de la Apuesta *
              </label>
              <textarea
                name='description'
                value={bet.description}
                onChange={handleChange}
                required
                rows={4}
                placeholder='Describe los detalles de la apuesta...'
                className='w-full px-4 py-3 border border-ink-300 rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none'
              />
            </div>

            {/* Price and Date Row */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='text-ink-700 block text-sm font-medium mb-2'>
                  Precio por Ticket *
                </label>
                <div className='relative'>
                  <span className='absolute left-3 top-3 text-ink-500'>$</span>
                  <input
                    type='number'
                    name='pricePerTicket'
                    value={bet.pricePerTicket}
                    onChange={handleChange}
                    required
                    step='0.01'
                    min='0'
                    placeholder='0.00'
                    className='w-full pl-8 pr-4 py-3 border border-ink-300 rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all'
                  />
                </div>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {PRICE_PRESETS.map((p) => (
                    <button
                      key={p}
                      type='button'
                      onClick={() =>
                        setBet((prev) => ({ ...prev, pricePerTicket: p }))
                      }
                      className={`rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors ${
                        Number(bet.pricePerTicket) === p
                          ? "bg-brand-600 text-on-brand"
                          : "bg-ink-100 text-ink-700 hover:bg-ink-300"
                      }`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className='text-ink-700 block text-sm font-medium mb-2'>
                  Fecha de Cierre *
                </label>
                <input
                  type='datetime-local'
                  name='date'
                  value={bet.date}
                  onChange={handleChange}
                  required
                  className='w-full px-4 py-3 border border-ink-300 rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all'
                />
              </div>
            </div>

            {/* Teams Section */}
            <div>
              <h3 className='text-ink-900 text-lg font-semibold mb-4'>
                Equipos Participantes
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='text-ink-700 block text-sm font-medium mb-2'>
                    Equipo A *
                  </label>
                  <input
                    type='text'
                    value={bet.teams.a}
                    onChange={(e) => handleTeamChange("a", e.target.value)}
                    required
                    placeholder='Nombre del primer equipo'
                    className='w-full px-4 py-3 border border-ink-300 rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-success-500 focus:ring-2 focus:ring-success-500/20 transition-all'
                  />
                </div>

                <div>
                  <label className='text-ink-700 block text-sm font-medium mb-2'>
                    Equipo B *
                  </label>
                  <input
                    type='text'
                    value={bet.teams.b}
                    onChange={(e) => handleTeamChange("b", e.target.value)}
                    required
                    placeholder='Nombre del segundo equipo'
                    className='w-full px-4 py-3 border border-ink-300 rounded-sm text-ink-900 bg-surface focus:outline-none focus:border-danger-500 focus:ring-2 focus:ring-danger-500/20 transition-all'
                  />
                </div>
              </div>
            </div>

            {/* Odds Section */}
            <div>
              <h3 className='text-ink-900 text-lg font-semibold mb-4'>
                Opciones del Sorteo
              </h3>
              <p className='text-xs text-ink-500 mb-4'>
                Sorteo parimutual: los pagos se calculan del pool al cerrar
                (pool &times; (1 &minus; takeRate) / boletos ganadores). No se
                fijan cuotas previas.
              </p>
              <div className='flex items-center mb-4'>
                <input
                  id='enableTie'
                  type='checkbox'
                  checked={bet.oddsTie !== undefined}
                  onChange={(e) => {
                    setBet((prev) => ({
                      ...prev,
                      oddsTie: e.target.checked ? "" : undefined,
                    }));
                  }}
                  className='h-4 w-4 text-brand-600 focus:ring-brand-500 border-ink-300 rounded-sm'
                />
                <label
                  htmlFor='enableTie'
                  className='ml-2 block text-ink-700 text-sm font-medium'
                >
                  ¿Permitir empate?
                </label>
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className='text-ink-700 block text-sm font-medium mb-2'>
                Imagen de la Apuesta *
              </label>
              <div className='border-2 border-dashed border-ink-300 rounded-card p-6 text-center hover:border-brand-500 transition-colors'>
                <input
                  type='file'
                  name='betImage'
                  onChange={handleFileChange}
                  accept='image/*'
                  required
                  className='hidden'
                  id='image-upload'
                />
                <label htmlFor='image-upload' className='cursor-pointer'>
                  <div className='text-ink-500 mb-2'>
                    <svg
                      className='mx-auto h-12 w-12 mb-2'
                      stroke='currentColor'
                      fill='none'
                      viewBox='0 0 48 48'
                    >
                      <path
                        d='M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                    <p className='text-sm'>
                      {bet.image
                        ? bet.image.name
                        : "Haz clic para subir una imagen"}
                    </p>
                  </div>
                </label>
              </div>
              <p className='text-sm mt-2 text-center'>
                <span
                  className={bet.image ? "text-success-700" : "text-ink-500"}
                >
                  {bet.image
                    ? "✓ Imagen cargada correctamente"
                    : "Formatos soportados: JPG, PNG, GIF (máx. 5MB)"}
                </span>
              </p>
            </div>

            {/* Submit Button */}
            <div className='pt-4'>
              <button
                disabled={isLoading || !isFormValid}
                type='submit'
                className='w-full bg-brand-cta hover:bg-brand-cta-hover text-ink-900 py-4 px-6 rounded-sm font-semibold text-lg shadow-cta hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] disabled:hover:scale-100'
              >
                {isLoading ? (
                  <div className='flex items-center justify-center'>
                    <svg
                      className='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
                      fill='none'
                      viewBox='0 0 24 24'
                    >
                      <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                      ></circle>
                      <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      ></path>
                    </svg>
                    Creando Apuesta...
                  </div>
                ) : (
                  "🎯 Crear Apuesta"
                )}
              </button>
            </div>

            {/* Form Status */}
            {!isFormValid && (
              <div className='text-center text-ink-500 text-sm'>
                * Completa todos los campos obligatorios para continuar
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default WithAuth(CreateBet);