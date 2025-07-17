'use client'
import Link from "next/link";
import { toast } from "nextjs-toast-notify";
import { useEffect, useState } from "react"
import { FadeLoader } from "react-spinners";

interface IBetsData{
  id: string,
  data: { number: number; sold: boolean; id: string }[];
  pricePerTicket: string;
  image: string;
  title: string;
  date: string;
  description: string;
  initialPool: number;
  betsTeamA: number;
  betsTeamB: number;
  teams: Array<string>;
  isFinished: boolean;
}

export default function BetsPage() {

  const [dataBet, setDataBet] = useState<IBetsData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    
    const fetchBets = async () => {
      
      try{
        setIsLoading(true);
        const response = await fetch(
          //`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL}/getAllBets`,
          `https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getAllBets`,
          {
            cache: "no-store",
          }
        );

        if(!response.ok){
          console.error(response);
          throw new Error("Failed to fetch bet data");
        }
        
        const data = await response.json();
        setDataBet(data.result); 
        setIsLoading(false);
      }catch(err){
        
      }
    }
    fetchBets();
  },[])

  const copyToClipboard = (text: any) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.info(`Link copiado al portapapeles!`,{
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

  return(
    <div>
      <h2 className="text-center mt-4">Apuestas actuales</h2>
      {isLoading ? (
        <div className="flex justify-center mt-20"><FadeLoader color='#ffffff'/> </div>
      ):( 
        <ul className="space-y-6 m-5 mt-6">
          {dataBet.map((bet) => (
            <li key={bet.id} className="bg-gray-600 my-3 px-4 py-6 rounded-md">
              <p className="text-lg">🎯 Apuesta: {bet.title}</p>
              <p>Pool actual: ${bet.initialPool}</p>
              <p>Equipo A: {bet.teams[0]} - {bet.betsTeamA}</p>
              <p>Equipo B: {bet.teams[1]} - {bet.betsTeamB}</p>
              <p>Fecha de cierre: {bet.date}</p>
              <Link href={`https://raffleapp-dbc1b.web.app/bet/${bet.id}`} className="text-blue-300 underline">Ir a la apuesta</Link> 
              <div className="flex justify-center sm:justify-start">
                <button
                  className="text-gray-950 font-mono px-4 mt-4 bg-gray-100 rounded-md border border-gray-300 hover:bg-gray-200 active:bg-gray-300"             
                  onClick={() => copyToClipboard(`https://raffleapp-dbc1b.web.app/bet/${bet.id}`)}
                >
                  Link de la apuesta
                </button>
              </div>
              
            </li>
          ))}
        </ul>
      )}
    </div>
  )  
};
