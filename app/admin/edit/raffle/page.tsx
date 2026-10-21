'use client'
import { apiUrl, authedApiFetch } from "@/app/config/api";
import DeleteRaffleModal from "@/app/components/DeleteRaffleModal";
import withAuth from "@/app/components/WithAuth";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { toast } from "nextjs-toast-notify";
import { useEffect, useRef, useState } from "react";
import { FadeLoader } from "react-spinners";

interface IRaffleData{
  id: string,
  title: string,
}

const EditRaffle = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRaffle, setIsLoadingRaffle] = useState(false);
  const [idRaffle, setIdRaffle] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [rafflesData, setRafflesData] = useState<IRaffleData[]>([])
  const [updatedRafflesData, setUpdatedRafflesData] = useState(false);
  const [raffle, setRaffle] = useState({
    title: "",
    date: "",
    numberOfTickets: "",
    pricePerTicket: "",
    awardName: "",
    awardDescription: "",
    ticketWinner: "",
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
    const fileImage = e.target.files[0];
    setNewImage(fileImage);
  };

  const handleDeleteRaffle = async (raffleId: string) => {
    
    try{
      const result = await authedApiFetch("deleteRaffle", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({idRaffle, raffle}),
        }
      )

      if (!result.ok) {
        console.log(result);
        throw new Error(result.statusText);
      }
    }catch(e){
      console.error(e);
    }
    toast.success(`Rifa borrada correctamente`,{
      duration: 2000,
      progress: false,
      position: 'top-right',
      transition: 'popUp',
      icon: '',
      sound: false,
    });
    cleanRaffle();
    resetForm();
    setTimeout(() => {
      setUpdatedRafflesData((prev) => !prev);
    }, 1000);    
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const downloadURL = await uploadRaffleImage(
      newImage as any,
      raffle.title
    );
    if(downloadURL != '') raffle.awardImage = downloadURL;

    try{
      const result = await authedApiFetch("updateRaffle", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({idRaffle, raffle}),
        } 
      )

      if (!result.ok) {
        console.log(result);
        throw new Error(result.statusText);
      }
    }catch(e){
      console.log(e);
    }
    setIsLoading(false);
    cleanRaffle();
    setNewImage(null)
    resetForm();
    toast.success(`Rifa actualizada correctamente`,{
      duration: 2000,
      progress: false,
      position: 'top-right',
      transition: 'popUp',
      icon: '',
      sound: false,
    });
    setUpdatedRafflesData((prev) => !prev);
  }

  const uploadRaffleImage = async (file: File, raffleId: string) => {
    const storage = getStorage();
    const storageRef = ref(storage, `raffleImages/${raffleId}`);

    if(newImage != null) {
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
    return '';
  };

  const cleanRaffle = () => setRaffle({title: "", date: "", numberOfTickets: "", pricePerTicket: "", awardName: "", awardDescription: "", ticketWinner: "", awardImage: "",});
  
  const handleChangeRaffle = async (id: string) => {
    if(id=='default'){
      setIdRaffle(id);
      cleanRaffle();
      return;
    }
    setIsLoadingRaffle(true);
    setIdRaffle(id);
    try{
      const responseData = await fetch(
        //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getRaffleData`,
        apiUrl("getRaffleData"),
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
      
      setRaffle((prevRaffle) => ({
        ...prevRaffle,
        title: result.raffleData.title || "",
        date: result.raffleData.date || "",
        numberOfTickets: result.raffleData.numberOfTickets || "0",
        pricePerTicket: result.raffleData.pricePerTicket || "0",
        awardName: result.raffleData.awardName || "",
        awardDescription: result.raffleData.awardDescription || "",
        ticketWinner: result.raffleData.ticketWinner || "",
        awardImage: result.raffleData.awardImage || "",
      }))
      setIsLoadingRaffle(false);
    }catch(e){
      console.log(e);
    }
  }

  useEffect(() => {
    const createNumberArray = Array.from({ length: 100 }, (_, i) => i);
    setOptions(createNumberArray);
    setIdRaffle('default');
    const fetchRaffleData = async () => {
      try {
        const response = await fetch(
          //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getAllRaffles`,
          apiUrl("getAllRaffles"),
          {cache: "no-store",}
        );

        if (!response.ok) {
          console.log(response);
          throw new Error("Failed to fetch raffle data");
        }

        const data = await response.json();
        const raffles = data.result.map(({ id, title }: { id: string; title: string }) => ({
          id,
          title,
        }));
        setRafflesData(raffles);
       
      } catch (e) {
        console.log(e);   
      }
    };
    fetchRaffleData();
  }, [updatedRafflesData]); 

  const formRef = useRef<HTMLFormElement>(null);
  const resetForm = () => {
    formRef.current?.reset();
  }
  const isValidRaffle = idRaffle != 'default';
  console.log('Rifa valida:',isValidRaffle)
  return(
    <div className='max-w-lg mx-auto bg-white p-6 rounded-lg shadow-lg mt-5'>
      <h2 className='text-black text-2xl font-bold mb-6 text-center'>
        Editar rifa
      </h2>
      <form ref={formRef} onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Rifas disponibles:
          </label>
          <select 
            className="w-full py-2 px-3 text-gray-950 bg-white border rounded-lg focus:border-blue-500"
            onChange={(e) => handleChangeRaffle(e.target.value)}
          >
            <option value={'default'}>Selecciona una rifa</option>
            {rafflesData.map((raffle) => (
              <option key={raffle.id} value={raffle.id}>{raffle.title}</option>
            ))}
          </select>
        </div>
        {isLoadingRaffle ? <div className="flex justify-center pt-2"><FadeLoader color="var(--color-ink-900)"/></div> : 
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
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            {/* <div>
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
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
              />
            </div> */}
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
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
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
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
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
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500'
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
                className='w-full px-4 py-2 border rounded-lg text-gray-950 bg-white focus:outline-none focus:border-blue-500 mb-2'
              />
            </div>
            <div>
              <label className='text-black block text-sm font-medium mb-1'>
                Boleto ganador
              </label>
              <select 
                className="py-2 px-3 text-gray-950 bg-white border rounded-lg focus:border-blue-500" 
                name="ticketWinner"
                value={raffle.ticketWinner}
                onChange={handleChange}
              >
                <option value=''>Selecciona un ganador</option>
                <option value='.'>No hay ganador</option>
                {options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className='text-black block text-sm font-medium mb-1 mt-2'>
                Actualizar Imagen del Premio:
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
              {newImage ? "Imagen cargada" : "Cargar imagen nueva del premio"}
            </p>
            <div className="mt-3">
              <label className="text-black mb-1">Imagen Actual</label>
              <img src={raffle.awardImage} alt="imagen actual de la rifa" />
            </div>
          </div>
        }
        <div className={`flex gap-1 ${!isValidRaffle ? 'opacity-50 cursor-none' : ''}`}>
          <button
            disabled={isLoading || !isValidRaffle}
            type='submit'
            className={`w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold 
              hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50
              `
            }
          >
            {isLoading ? "Actualizando..." : "Actualizar rifa"}
          </button>
          <DeleteRaffleModal idRaffle={idRaffle} isAvailable={!isValidRaffle} onDelete={handleDeleteRaffle} />
        </div>        
      </form>
    </div>
  )
};

export default withAuth(EditRaffle)