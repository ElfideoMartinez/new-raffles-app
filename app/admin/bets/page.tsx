"use client";
import Link from "next/link";
import Image from "next/image";
import { toast } from "nextjs-toast-notify";
import { useEffect, useState } from "react";
import { FadeLoader } from "react-spinners";
import { onValue, ref, set, update } from "firebase/database";
import { realtimeDB } from "@/app/firebaseconfig";

interface IBetsData {
  id: string;
  data: { number: number; sold: boolean; id: string }[];
  pricePerTicket: string;
  image: string;
  title: string;
  date: string;
  description: string;
  initialPool: number;
  betsTeamA: number;
  betsTeamB: number;
  oddsTeamA?: string;
  oddsTeamB?: string;
  tieBets?: number;
  teams: { a: string; b: string };
  isFinished: boolean;
  totalBets?: number;
}

interface EditBetFormData {
  title: string;
  description: string;
  pricePerTicket: string;
  date: string;
  teams: { a: string; b: string };
  image: string;
  oddsTeamA: string;
  oddsTeamB: string;
}

function EditBetModal({
  bet,
  isOpen,
  onClose,
  onSave,
}: {
  bet: IBetsData;
  isOpen: boolean;
  onClose: () => void;
  onSave: (betId: string, updatedData: EditBetFormData) => void;
}) {
  const [formData, setFormData] = useState<EditBetFormData>({
    title: bet.title,
    image: bet.image,
    description: bet.description,
    pricePerTicket: bet.pricePerTicket,
    date: bet.date,
    teams: { a: bet.teams.a || "", b: bet.teams.b || "" },
    oddsTeamA: bet.oddsTeamA || "",
    oddsTeamB: bet.oddsTeamB || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(bet.id, formData);
    onClose();
  };

  const handleInputChange = (field: keyof EditBetFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTeamChange = (index: 0 | 1, value: string) => {
    setFormData((prev) => ({
      ...prev,
      teams:
        index === 0
          ? { a: value, b: prev.teams.b }
          : { a: prev.teams.a, b: value },
    }));
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
      <div className='bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold text-white'>Editar Apuesta</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-white text-2xl'
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-300 mb-1'>
              Título
            </label>
            <input
              type='text'
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
              required
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-300 mb-1'>
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 h-24'
              required
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-1'>
                Precio por boleto
              </label>
              <input
                type='number'
                step='0.01'
                value={formData.pricePerTicket}
                onChange={(e) =>
                  handleInputChange("pricePerTicket", e.target.value)
                }
                className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
                required
              />
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-300 mb-1'>
              Fecha de cierre
            </label>
            <input
              type='datetime-local'
              value={formData.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
              className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
              required
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-1'>
                Equipo A
              </label>
              <input
                type='text'
                value={formData.teams.a}
                onChange={(e) => handleTeamChange(0, e.target.value)}
                className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
                required
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-300 mb-1'>
                Equipo B
              </label>
              <input
                type='text'
                value={formData.teams.b}
                onChange={(e) => handleTeamChange(1, e.target.value)}
                className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
                required
              />
            </div>
          </div>
          <div>
            Favor Equipo A *
            <input
              type='text'
              value={formData.oddsTeamA || ""}
              onChange={(e) => handleInputChange("oddsTeamA", e.target.value)}
              className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
              required
              placeholder='Ejemplo: -120, +110'
            />
          </div>
          <div>
            Favor Equipo B *
            <input
              type='text'
              value={formData.oddsTeamB || ""}
              onChange={(e) => handleInputChange("oddsTeamB", e.target.value)}
              className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
              required
              placeholder='Ejemplo: -120, +110'
            />
          </div>
          <div className='text-xs text-gray-400'>
            Link de imagen (opcional):
            <input
              type='text'
              value={formData.image || ""}
              onChange={(e) => handleInputChange("image", e.target.value)}
              className='w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500'
              placeholder='URL de la imagen'
            />
          </div>
          <div className='flex gap-4 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors'
            >
              Cancelar
            </button>
            <button
              type='submit'
              className='flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminBetCard({
  bet,
  onEdit,
}: {
  bet: IBetsData;
  onEdit: (bet: IBetsData) => void;
}) {
  const totalBets = bet.betsTeamA + bet.betsTeamB + (bet.tieBets || 0);
  const teamAPercentage =
    totalBets > 0 ? ((bet.betsTeamA / totalBets) * 100).toFixed(1) : "0";
  const teamBPercentage =
    totalBets > 0 ? ((bet.betsTeamB / totalBets) * 100).toFixed(1) : "0";

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.info(`Link copiado al portapapeles!`, {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
      })
      .catch((error) => console.error("Error al copiar:", error));
  };

  return (
    <div className='bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300'>
      {bet.image && (
        <div className='relative h-48 w-full'>
          <Image
            src={bet.image}
            alt={bet.title}
            fill
            className='object-cover'
          />
        </div>
      )}

      <div className='p-4'>
        <h3 className='text-xl font-bold text-white mb-2 line-clamp-2'>
          🎯 {bet.title}
        </h3>

        <p className='text-gray-300 text-sm mb-3 line-clamp-3'>
          {bet.description}
        </p>

        <div className='space-y-2 mb-4'>
          <div className='text-sm text-gray-400'>
            <span className='font-semibold'>Precio por boleto:</span>
            <span className='text-white'>${bet.pricePerTicket}</span>
          </div>
          <div className='text-sm text-gray-400'>
            <span className='font-semibold'>Total de apuestas:</span>
            <span className='text-white'>
              ${totalBets * parseFloat(bet.pricePerTicket)}
            </span>
          </div>

          <div className='text-sm text-gray-400'>
            <span className='font-semibold'>Fecha de cierre:</span>
            <span className='text-white'>
              {new Date(bet.date).toLocaleDateString()}
            </span>
          </div>

          <div className='text-sm text-gray-400'>
            <span className='font-semibold'>Estado:</span>
            <span
              className={`ml-1 px-2 py-1 rounded-md text-xs ${
                bet.isFinished
                  ? "bg-red-600 text-white"
                  : "bg-green-600 text-white"
              }`}
            >
              {bet.isFinished ? "Finalizada" : "Activa"}
            </span>
          </div>
        </div>

        {/* Teams and betting stats */}
        <div className='space-y-2 mb-4'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-green-400'>
              {bet.teams.a}
              <span className='ml-2 bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full'>
                ${bet.betsTeamA * parseFloat(bet.pricePerTicket)}
              </span>
            </span>
            <span className='text-sm text-gray-300'>
              {bet.betsTeamA} Apuestas ({teamAPercentage}%)
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-red-400'>
              {bet.teams.b}
              <span className='ml-2 bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full'>
                ${bet.betsTeamB * parseFloat(bet.pricePerTicket)}
              </span>
            </span>
            <span className='text-sm text-gray-300'>
              {bet.betsTeamB} Apuestas ({teamBPercentage}%)
            </span>
          </div>
          {bet.tieBets !== undefined && (
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium text-yellow-400'>
                Empate
                <span className='ml-2 bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full'>
                  ${bet.tieBets * parseFloat(bet.pricePerTicket)}
                </span>
              </span>
              <span className='text-sm text-gray-300'>
                {bet.tieBets} Apuestas (
                {totalBets > 0
                  ? ((bet.tieBets / totalBets) * 100).toFixed(1)
                  : "0"}
                %)
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className='space-y-2'>
          <Link
            target='_blank'
            href={`${process.env.NEXT_PUBLIC_BASE_URL}/bet/${bet.id}`}
            className='block w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors duration-300'
          >
            Ver Apuesta
          </Link>

          <div className='grid grid-cols-2 gap-2'>
            <button
              onClick={() => onEdit(bet)}
              className='w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-semibold transition-colors duration-300'
            >
              Editar
            </button>

            <button
              onClick={() =>
                copyToClipboard(`https://raffleapp-dbc1b.web.app/bet/${bet.id}`)
              }
              className='w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-semibold transition-colors duration-300'
            >
              Copiar Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BetsPage() {
  const [dataBet, setDataBet] = useState<IBetsData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingBet, setEditingBet] = useState<IBetsData | null>(null);

  useEffect(() => {
    const fetchBets = async () => {
      try {
        setIsLoading(true);
        const betsRef = ref(realtimeDB, "bets");
        onValue(betsRef, (snapshot) => {
          const betsData = snapshot.val();
          if (betsData) {
            const betsArray: IBetsData[] = Object.keys(betsData).map((key) => ({
              id: key,
              ...betsData[key],
            }));
            console.log(betsArray);
            setDataBet(betsArray);
          } else {
            setDataBet([]);
          }
        });

        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        toast.error("Error al cargar las apuestas", {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
      }
    };
    fetchBets();
  }, []);

  const handleEditBet = (bet: IBetsData) => {
    setEditingBet(bet);
  };

  const handleSaveBet = async (betId: string, updatedData: EditBetFormData) => {
    try {
      update(ref(realtimeDB, `bets/${betId}`), updatedData);
      setDataBet((prev) =>
        prev.map((bet) =>
          bet.id === betId
            ? {
                ...bet,
                ...updatedData,
                teams: { a: updatedData.teams.a, b: updatedData.teams.b },
              }
            : bet
        )
      );
      toast.info("Apuesta actualizada correctamente", {
        duration: 2000,
        progress: false,
        position: "top-right",
        transition: "popUp",
        icon: "",
        sound: false,
      });
    } catch (error) {
      toast.error("Error al actualizar la apuesta", {
        duration: 2000,
        progress: false,
        position: "top-right",
        transition: "popUp",
        icon: "",
        sound: false,
      });
    }
  };

  const closeEditModal = () => {
    setEditingBet(null);
  };

  const copyToClipboard = (text: any) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.info(`Link copiado al portapapeles!`, {
          duration: 2000,
          progress: false,
          position: "top-right",
          transition: "popUp",
          icon: "",
          sound: false,
        });
      })
      .catch((error) => console.error("Error al copiar:", error));
  };

  return (
    <div className='min-h-screen p-4'>
      <div className='max-w-7xl mx-auto'>
        <h2 className='text-3xl font-bold text-white text-center mb-8'>
          Administrar Apuestas
        </h2>
        <div className='flex justify-center mb-4'>
          <Link
            href={`${process.env.NEXT_PUBLIC_BASE_URL}/admin/create/bet`}
            className='px-4 py-2 bg-blue-600 hover:bg-green-700 text-white rounded-md font-semibold transition-colors duration-300'
          >
            + Crear Nueva Apuesta
          </Link>
        </div>
        {isLoading ? (
          <div className='flex justify-center mt-20'>
            <FadeLoader color='#ffffff' />
          </div>
        ) : dataBet.length === 0 ? (
          <div className='text-center text-gray-400 mt-20'>
            <p>No hay apuestas disponibles</p>
          </div>
        ) : (
          <div className='grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
            {dataBet.map((bet) => (
              <AdminBetCard key={bet.id} bet={bet} onEdit={handleEditBet} />
            ))}
          </div>
        )}
        {editingBet && (
          <EditBetModal
            bet={editingBet}
            isOpen={!!editingBet}
            onClose={closeEditModal}
            onSave={handleSaveBet}
          />
        )}
      </div>
    </div>
  );
}
