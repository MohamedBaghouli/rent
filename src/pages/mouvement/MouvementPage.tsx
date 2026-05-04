import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/app/layout";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { createCar } from "@/services/car.service";
import { createClient } from "@/services/client.service";
import { getCars } from "@/services/car.service";
import { getClients } from "@/services/client.service";
import type { Car as CarType } from "@/types/car";
import type { Client } from "@/types/client";
import {
  downloadCarTemplate,
  downloadClientTemplate,
  exportCarsToExcel,
  exportClientsToExcel,
  importCarsFromExcel,
  importClientsFromExcel,
} from "@/utils/excel";

type ImportState = "idle" | "loading" | "success" | "error";

interface ImportStatus {
  state: ImportState;
  message: string;
  count?: number;
}

const IDLE: ImportStatus = { state: "idle", message: "" };

export function MouvementPage() {
  const { showToast } = useToast();

  const [cars, setCars] = useState<CarType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [carImport, setCarImport] = useState<ImportStatus>(IDLE);
  const [clientImport, setClientImport] = useState<ImportStatus>(IDLE);

  const carFileRef = useRef<HTMLInputElement>(null);
  const clientFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([getCars(), getClients()])
      .then(([c, cl]) => { setCars(c); setClients(cl); })
      .finally(() => setLoadingData(false));
  }, []);

  // ── Car export ──────────────────────────────────────────────────────────────

  function handleExportCars() {
    try {
      exportCarsToExcel(cars, `voitures_${todayKey()}.xlsx`);
      showToast({ title: `${cars.length} voitures exportées`, type: "success" });
    } catch (error) {
      showToast({ title: "Erreur export voitures", message: String(error), type: "error" });
    }
  }

  // ── Car import ──────────────────────────────────────────────────────────────

  async function handleCarFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setCarImport({ state: "loading", message: "Validation du fichier..." });

    const outcome = await importCarsFromExcel(file);
    if (!outcome.success) {
      setCarImport({ state: "error", message: outcome.message });
      return;
    }

    setCarImport({ state: "loading", message: `Importation de ${outcome.cars.length} voitures...` });

    try {
      let inserted = 0;
      for (const car of outcome.cars) {
        await createCar(car);
        inserted++;
      }
      const fresh = await getCars();
      setCars(fresh);
      setCarImport({ state: "success", message: `${inserted} voitures importées avec succès.`, count: inserted });
      showToast({ title: `${inserted} voitures importées`, type: "success" });
    } catch (error) {
      setCarImport({ state: "error", message: `Erreur lors de l'insertion : ${String(error)}` });
    }
  }

  // ── Client export ───────────────────────────────────────────────────────────

  function handleExportClients() {
    try {
      exportClientsToExcel(clients, `clients_${todayKey()}.xlsx`);
      showToast({ title: `${clients.length} clients exportés`, type: "success" });
    } catch (error) {
      showToast({ title: "Erreur export clients", message: String(error), type: "error" });
    }
  }

  // ── Client import ───────────────────────────────────────────────────────────

  async function handleClientFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setClientImport({ state: "loading", message: "Validation du fichier..." });

    const outcome = await importClientsFromExcel(file);
    if (!outcome.success) {
      setClientImport({ state: "error", message: outcome.message });
      return;
    }

    setClientImport({ state: "loading", message: `Importation de ${outcome.clients.length} clients...` });

    try {
      let inserted = 0;
      for (const client of outcome.clients) {
        await createClient(client);
        inserted++;
      }
      const fresh = await getClients();
      setClients(fresh);
      setClientImport({ state: "success", message: `${inserted} clients importés avec succès.`, count: inserted });
      showToast({ title: `${inserted} clients importés`, type: "success" });
    } catch (error) {
      setClientImport({ state: "error", message: `Erreur lors de l'insertion : ${String(error)}` });
    }
  }

  return (
    <>
      <PageHeader title="Mouvement" />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Importez et exportez vos données en format Excel (.xlsx). L'import utilise un template strict —
        toute erreur stoppe l'opération et affiche la ligne exacte concernée.
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Voitures ── */}
        <MouvementCard
          color="blue"
          count={loadingData ? null : cars.length}
          icon={<Car className="h-5 w-5" />}
          importStatus={carImport}
          label="Voitures"
          onExport={handleExportCars}
          onImport={() => carFileRef.current?.click()}
          onReset={() => setCarImport(IDLE)}
          onTemplate={() => downloadCarTemplate()}
        />

        {/* ── Clients ── */}
        <MouvementCard
          color="emerald"
          count={loadingData ? null : clients.length}
          icon={<UserRound className="h-5 w-5" />}
          importStatus={clientImport}
          label="Clients"
          onExport={handleExportClients}
          onImport={() => clientFileRef.current?.click()}
          onReset={() => setClientImport(IDLE)}
          onTemplate={() => downloadClientTemplate()}
        />
      </div>

      {/* Hidden file inputs */}
      <input accept=".xlsx,.xls" className="hidden" onChange={(e) => void handleCarFileChange(e)} ref={carFileRef} type="file" />
      <input accept=".xlsx,.xls" className="hidden" onChange={(e) => void handleClientFileChange(e)} ref={clientFileRef} type="file" />

      {/* Template info */}
      <Card className="mt-6 dark:bg-slate-900 dark:border-slate-800">
        <CardTitle className="mb-3 text-base font-semibold text-foreground">Format du template strict</CardTitle>
        <div className="grid gap-6 md:grid-cols-2">
          <TemplateInfo
            color="bg-blue-600"
            columns={[
              "Marque *", "Modele *", "Immatriculation *", "Annee",
              "Carburant *", "Transmission", "Prix/Jour *", "Kilometrage",
              "Statut", "Expiry Assurance", "Expiry Visite",
            ]}
            title="Voitures (11 colonnes)"
            notes={[
              "Statut : AVAILABLE / RENTED / MAINTENANCE / UNAVAILABLE",
              "Carburant : Essence / Diesel / Hybride / Electrique / GPL",
              "Dates format : YYYY-MM-DD",
            ]}
          />
          <TemplateInfo
            color="bg-emerald-600"
            columns={[
              "Nom complet *", "Telephone *", "CIN", "Passeport",
              "Permis *", "Date permis", "Date naissance", "Lieu naissance",
              "Nationalite", "Adresse", "Actif",
            ]}
            title="Clients (11 colonnes)"
            notes={[
              "Actif : true / false",
              "Telephone : chiffres uniquement, 6-15 caracteres",
              "Dates format : YYYY-MM-DD",
            ]}
          />
        </div>
      </Card>
    </>
  );
}

function MouvementCard({
  color,
  count,
  icon,
  importStatus,
  label,
  onExport,
  onImport,
  onReset,
  onTemplate,
}: {
  color: "blue" | "emerald";
  count: number | null;
  icon: React.ReactNode;
  importStatus: ImportStatus;
  label: string;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onTemplate: () => void;
}) {
  const accent = color === "blue" ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400";
  const bg = color === "blue" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-emerald-50 dark:bg-emerald-900/20";
  const border = color === "blue" ? "border-blue-200 dark:border-blue-800" : "border-emerald-200 dark:border-emerald-800";
  const iconBg = color === "blue" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";

  return (
    <Card className="dark:bg-slate-900 dark:border-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">{label}</CardTitle>
            {count !== null && (
              <p className={`text-sm font-medium ${accent}`}>{count} enregistrement{count !== 1 ? "s" : ""}</p>
            )}
          </div>
        </div>
      </div>

      {/* Export section */}
      <div className={`mb-4 rounded-lg border ${border} ${bg} p-4`}>
        <p className="mb-3 text-sm font-semibold text-foreground">Export</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={count === 0 || count === null} onClick={onExport} size="sm" type="button" variant="outline">
            <Download className="h-3.5 w-3.5" />
            Exporter les données (.xlsx)
          </Button>
          <Button onClick={onTemplate} size="sm" type="button" variant="ghost">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Télécharger le template vide
          </Button>
        </div>
      </div>

      {/* Import section */}
      <div className="rounded-lg border border-border bg-slate-50 p-4 dark:bg-slate-950 dark:border-slate-800">
        <p className="mb-3 text-sm font-semibold text-foreground">Import</p>

        {importStatus.state === "idle" && (
          <Button onClick={onImport} size="sm" type="button">
            <Upload className="h-3.5 w-3.5" />
            Importer un fichier .xlsx
          </Button>
        )}

        {importStatus.state === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {importStatus.message}
          </div>
        )}

        {importStatus.state === "success" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {importStatus.message}
            </div>
            <Button onClick={onReset} size="sm" type="button" variant="outline">
              Importer un autre fichier
            </Button>
          </div>
        )}

        {importStatus.state === "error" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importStatus.message}</span>
            </div>
            <Button onClick={onReset} size="sm" type="button" variant="outline">
              Réessayer
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function TemplateInfo({
  color,
  columns,
  notes,
  title,
}: {
  color: string;
  columns: string[];
  notes: string[];
  title: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {columns.map((col) => (
          <span
            className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            key={col}
          >
            {col}
          </span>
        ))}
      </div>
      <ul className="space-y-1">
        {notes.map((note) => (
          <li className="flex items-start gap-1.5 text-xs text-muted-foreground" key={note}>
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
