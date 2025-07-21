"use client";
import withAuth from "@/app/components/WithAuth";
import ButtonDashboard from "@/app/components/ButtonDashboard";

const DashboardPage = () => {
  return (
    <div className="flex gap-5 justify-center items-center mt-8 flex-col mx-4">
      <div className="w-3/4 flex flex-col items-center gap-2 md:flex-row md:justify-evenly border-2 border-opacity-10 border-white rounded-lg py-5">
        <ButtonDashboard buttonName='Ventas/Rifas' url='/admin/sales'/>
        <ButtonDashboard buttonName='Crear Rifa' url='/admin/create/raffle'/>
        <ButtonDashboard buttonName='Editar Rifa' url='/admin/edit/raffle'/>
      </div>
      <div className="w-3/4 flex flex-col items-center gap-2 md:flex-row md:justify-evenly border-2 border-opacity-10 border-white rounded-lg py-5">
        <ButtonDashboard buttonName='Ventas/Apuestas' url='/admin/salesBets'/>
        <ButtonDashboard buttonName='Ver Apuestas' url='/admin/bets'/>
        <ButtonDashboard buttonName='Crear Apuesta' url='/admin/create/bet'/>
        <ButtonDashboard buttonName='Editar Apuesta' url='/admin/edit/bet'/>
      </div>
    </div>
  );
};

export default withAuth(DashboardPage);
