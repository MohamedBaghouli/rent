import { createHashRouter } from "react-router-dom";
import { App } from "@/app/App";
import { CarsPage } from "@/pages/cars/CarsPage";
import { ClientsPage } from "@/pages/clients/ClientsPage";
import { ContractPreview } from "@/pages/contracts/ContractPreview";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { PaymentDetailsPage } from "@/pages/payments/PaymentDetailsPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { ReservationsPage } from "@/pages/reservations/ReservationsPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "cars", element: <CarsPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "reservations", element: <ReservationsPage /> },
      { path: "payments", element: <PaymentsPage /> },
      { path: "payments/detail", element: <PaymentDetailsPage /> },
      { path: "payments/:paymentId", element: <PaymentDetailsPage /> },
      { path: "contracts", element: <ContractPreview /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);
