'use client'
import WithAuth from "@/app/components/WithAuth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { toast } from "nextjs-toast-notify";
import { useMemo, useRef, useState } from "react";

interface IBet {
  title: string;
  description: string;
  image: string;
  date: string;
  pricePerTicket: string;
  initialPool: number;
  teams: Array<string>;
  betsTeamA: number;
  betsTeamB: number;
}

const CreateBet = () => {

  const [isLoading, setIsLoading] = useState(false);
  const [bet, setBet] = useState({
    title: "",
    description: "",
    image: "",
    date: "",
    pricePerTicket: "",
    initialPool: "",
    teams: ["",""],
    betsTeamA: 0,
    betsTeamB: 0
  })

  const handleChange = (e: React.ChangeEvent<any>) => { 
    const { name, value } = e.target

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

  const handleFileChange = (e:any) => {
    const file = e.target.files[0];
    if(!file) return;
    setBet({
      ...bet,
      image: file,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const formDataBet = new FormData();
    formDataBet.append("title", bet.title);
    formDataBet.append("description", bet.description);
    formDataBet.append("date", bet.date);
    formDataBet.append("pricePerTicket", bet.pricePerTicket);
    formDataBet.append("initialPool", bet.initialPool);
    formDataBet.append("teams", JSON.stringify(bet.teams));
    formDataBet.append("betTeamA", bet.betsTeamA.toString());
    formDataBet.append("betTeamA", bet.betsTeamB.toString());

    const downloadURL = await uploadRaffleImage(
      bet.image as any,
      bet.title
    );
    formDataBet.append("image", downloadURL);
    
    // Convert FormData to a plain object
    const plainObject: { [key: string]: string | File | number} = Object.fromEntries(formDataBet.entries());

    const betData: IBet = {
      title: plainObject.title as string,
      description: plainObject.description as string,
      date: plainObject.date as string,
      pricePerTicket: plainObject.pricePerTicket as string,
      image: plainObject.image as string,
      initialPool: parseInt(plainObject.initialPool as string),
      teams: JSON.parse(plainObject.teams as string),
      betsTeamA: 0,
      betsTeamB: 0
    };

    console.log("Plain Object",betData);
    createNewBet(betData);
    resetForm();
    setIsLoading(false);
    toast.success(`Apuesta creada exitosamente`,{
      duration: 2000,
      progress: false,
      position: 'top-right',
      transition: 'popUp',
      icon: '',
      sound: false,
    });   
  };

  const uploadRaffleImage = async (file: File, betId: string) => {
    const storage = getStorage();
    const storageRef = ref(storage, `betImages/${betId}`);

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    console.log("Uploaded a blob or file!", snapshot);

    // Get and return the download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  const createNewBet = async (bet: IBet) => {

    const betData = {
      ...bet,
    }

    const res = await fetch(
      //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/createBet`,
      `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/createBet`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(betData),
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

  const isFormValid = useMemo(() => {
    const areStringsValid =
      bet.title.trim() !== "" &&
      bet.description.trim() !== "" &&
      String(bet.image ?? "").trim() !== "" &&
      bet.date.trim() !== "" &&
      bet.pricePerTicket.trim() !== "" &&
      bet.initialPool.trim() !== "";
 
    const areTeamsValid =
      bet.teams.length === 2 && 
      bet.teams[0].trim() !== "" && 
      bet.teams[1].trim() !== "";   

    return areStringsValid && areTeamsValid;
  }, [bet]);

  const formRef = useRef<HTMLFormElement>(null);
  const resetForm = () => {
    formRef.current?.reset();
    setBet({title: "", description: "", image: "", pricePerTicket: "", date: "", teams: ["",""], initialPool: "", betsTeamA: 0, betsTeamB: 0 });
  }

  return (
    <div className='max-w-lg mx-auto bg-white p-6 rounded-lg shadow-lg mt-5'>
      <h2 className='text-black text-2xl font-bold mb-6 text-center'>
        Crear nueva apuesta
      </h2>
      <form ref={formRef} onSubmit={handleSubmit} className='space-y-4'>
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

        <div>
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
        
        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Fecha de cierre:
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
        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Pozo inicial:
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

        <div>
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

        <div>
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

        <div>
          <label className='text-black block text-sm font-medium mb-1'>
            Imagen de la apuesta:
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
        <button
          disabled={isLoading || !isFormValid}
          type='submit'
          className='w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50'
        >
          {isLoading ? "Creando..." : "Crear Apuesta"}
        </button>
      </form>
    </div>
  )
} 

export default WithAuth(CreateBet);
