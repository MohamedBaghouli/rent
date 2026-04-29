import {
  Banknote,
  CalendarDays,
  Car,
  FileText,
  Gauge,
  LayoutDashboard,
  Settings,
  UserRound,
} from "lucide-react";

export const navigationItems = [
  { label: "Tableau de bord", path: "/", icon: LayoutDashboard },
  { label: "Voitures", path: "/cars", icon: Car },
  { label: "Clients", path: "/clients", icon: UserRound },
  { label: "Réservations", path: "/reservations", icon: CalendarDays },
  { label: "Paiements", path: "/payments", icon: Banknote },
  { label: "Contrats", path: "/contracts", icon: FileText },
  { label: "Paramètres", path: "/settings", icon: Settings },
];

export const appName = "RentalDesk";

export const dashboardCards = [
  { label: "Total voitures", valueKey: "totalCars", icon: Car },
  { label: "Disponibles", valueKey: "availableCars", icon: Gauge },
  { label: "Louées", valueKey: "rentedCars", icon: CalendarDays },
  { label: "Revenus mois", valueKey: "monthlyRevenue", icon: Banknote },
] as const;
