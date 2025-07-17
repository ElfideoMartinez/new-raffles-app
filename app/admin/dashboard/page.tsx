"use client";
import withAuth from "@/app/components/WithAuth";
import ButtonDashboard from "@/app/components/ButtonDashboard";

const DashboardPage = () => {
  return (
    <div className='flex gap-5 justify-center items-center mt-8 flex-col sm:flex-row'>
      <ButtonDashboard buttonName='Ventas' url='/admin/sales' />
      <ButtonDashboard buttonName='Crear Rifa' url='/admin/create/raffle' />
      <ButtonDashboard buttonName='Editar Rifa' url='/admin/edit/raffle' />
    </div>
  );
};

export default withAuth(DashboardPage);
