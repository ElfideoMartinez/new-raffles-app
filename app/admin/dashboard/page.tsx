"use client";
import withAuth from "@/app/components/WithAuth";
import ButtonDashboard from "@/app/components/ButtonDashboard";

type Group = {
  title: string;
  buttons: { buttonName: string; url: string }[];
};

const groups: Group[] = [
  {
    title: "Rifas",
    buttons: [
      { buttonName: "Ventas/Rifas", url: "/admin/sales" },
      { buttonName: "Crear Rifa", url: "/admin/create/raffle" },
      { buttonName: "Editar Rifa", url: "/admin/edit/raffle" },
    ],
  },
  {
    title: "Apuestas",
    buttons: [
      { buttonName: "Ventas/Apuestas", url: "/admin/salesBets" },
      { buttonName: "Ver Apuestas", url: "/admin/bets" },
      { buttonName: "Crear Apuesta", url: "/admin/create/bet" },
      { buttonName: "Editar Apuesta", url: "/admin/edit/bet" },
    ],
  },
  {
    title: "Boletos rápidos",
    buttons: [{ buttonName: "Ventas rápidas", url: "/admin/quickTickets/active" }],
  },
  {
    title: "Configuración",
    buttons: [{ buttonName: "Configuración", url: "/admin/config" }],
  },
];

const DashboardPage = () => {
  return (
    <div className="flex gap-5 justify-center items-center mt-8 flex-col mx-4">
      {groups.map((group) => (
        <div
          key={group.title}
          className="w-3/4 flex flex-col items-center gap-3 border-2 border-opacity-10 border-white rounded-card py-5"
        >
          <h2 className="text-white text-sm font-semibold uppercase tracking-wide opacity-70">
            {group.title}
          </h2>
          <div className="w-full flex flex-col items-center gap-2 md:flex-row md:justify-evenly md:flex-wrap px-4">
            {group.buttons.map((b) => (
              <ButtonDashboard key={b.url} {...b} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default withAuth(DashboardPage);
