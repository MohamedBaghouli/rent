import * as XLSX from "xlsx";
import type { Car, CreateCarDto } from "@/types/car";
import type { Client, CreateClientDto } from "@/types/client";

// ─── Car template ───────────────────────────────────────────────────────────

const CAR_HEADERS = [
  "Marque",
  "Modele",
  "Immatriculation",
  "Annee",
  "Carburant",
  "Transmission",
  "Prix/Jour",
  "Kilometrage",
  "Statut",
  "Expiry Assurance",
  "Expiry Visite",
];

const CAR_EXAMPLE_ROWS = [
  ["Toyota", "Yaris", "123TU4567", 2022, "Essence", "Manuelle", 85, 45000, "AVAILABLE", "2026-12-31", "2026-06-15"],
  ["Hyundai", "i20", "456TU7890", 2021, "Diesel", "Automatique", 95, 62000, "AVAILABLE", "2027-03-20", "2026-09-01"],
];

const VALID_CAR_STATUSES = new Set(["AVAILABLE", "RENTED", "MAINTENANCE", "UNAVAILABLE"]);
const VALID_FUELS = new Set(["Essence", "Diesel", "Hybride", "Electrique", "GPL"]);
const VALID_TRANSMISSIONS = new Set(["Manuelle", "Automatique"]);

export function exportCarsToExcel(cars: Car[], filename = "voitures.xlsx"): void {
  const rows = cars.map((car) => [
    car.brand,
    car.model,
    car.registrationNumber,
    car.year ?? "",
    car.fuelType,
    car.transmission,
    car.dailyPrice,
    car.mileage ?? "",
    car.status,
    car.insuranceExpiryDate ?? "",
    car.technicalVisitExpiryDate ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([CAR_HEADERS, ...rows]);
  styleHeaderRow(ws, CAR_HEADERS.length);
  ws["!cols"] = CAR_HEADERS.map(() => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Voitures");
  XLSX.writeFile(wb, filename);
}

export function downloadCarTemplate(filename = "template_voitures.xlsx"): void {
  const ws = XLSX.utils.aoa_to_sheet([CAR_HEADERS, ...CAR_EXAMPLE_ROWS]);
  styleHeaderRow(ws, CAR_HEADERS.length);
  ws["!cols"] = CAR_HEADERS.map(() => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Voitures");
  XLSX.writeFile(wb, filename);
}

export interface ImportCarResult {
  success: true;
  cars: CreateCarDto[];
}

export interface ImportCarError {
  success: false;
  line: number;
  column: string;
  message: string;
}

export type ImportCarOutcome = ImportCarResult | ImportCarError;

export function importCarsFromExcel(file: File): Promise<ImportCarOutcome> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as unknown[][];

        if (rows.length < 2) {
          resolve({ success: false, line: 1, column: "-", message: "Fichier vide ou sans données." });
          return;
        }

        const headers = rows[0] as string[];
        if (headers[0] !== "Marque" || headers[2] !== "Immatriculation") {
          resolve({
            success: false,
            line: 1,
            column: "En-tete",
            message: "Le fichier ne correspond pas au template voitures. Utilisez le template fourni.",
          });
          return;
        }

        const cars: CreateCarDto[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as string[];
          if (row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "")) continue;

          const lineNum = i + 1;
          const brand = String(row[0] ?? "").trim();
          const model = String(row[1] ?? "").trim();
          const registration = String(row[2] ?? "").trim();
          const year = row[3] ? Number(row[3]) : null;
          const fuelType = String(row[4] ?? "").trim();
          const transmission = String(row[5] ?? "Manuelle").trim();
          const dailyPrice = Number(row[6]);
          const mileage = row[7] ? Number(row[7]) : null;
          const status = String(row[8] ?? "AVAILABLE").trim().toUpperCase();
          const insuranceExpiry = parseExcelDate(row[9]);
          const techVisitExpiry = parseExcelDate(row[10]);

          if (!brand) {
            resolve({ success: false, line: lineNum, column: "Marque", message: `Ligne ${lineNum} : la marque est obligatoire.` });
            return;
          }
          if (!model) {
            resolve({ success: false, line: lineNum, column: "Modele", message: `Ligne ${lineNum} : le modele est obligatoire.` });
            return;
          }
          if (!registration) {
            resolve({ success: false, line: lineNum, column: "Immatriculation", message: `Ligne ${lineNum} : l'immatriculation est obligatoire.` });
            return;
          }
          if (!fuelType || !VALID_FUELS.has(fuelType)) {
            resolve({
              success: false,
              line: lineNum,
              column: "Carburant",
              message: `Ligne ${lineNum} : carburant invalide "${fuelType}". Valeurs : ${[...VALID_FUELS].join(", ")}.`,
            });
            return;
          }
          if (!VALID_TRANSMISSIONS.has(transmission)) {
            resolve({
              success: false,
              line: lineNum,
              column: "Transmission",
              message: `Ligne ${lineNum} : transmission invalide "${transmission}". Valeurs : Manuelle, Automatique.`,
            });
            return;
          }
          if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) {
            resolve({ success: false, line: lineNum, column: "Prix/Jour", message: `Ligne ${lineNum} : prix/jour invalide ou nul.` });
            return;
          }
          if (!VALID_CAR_STATUSES.has(status)) {
            resolve({
              success: false,
              line: lineNum,
              column: "Statut",
              message: `Ligne ${lineNum} : statut invalide "${status}". Valeurs : ${[...VALID_CAR_STATUSES].join(", ")}.`,
            });
            return;
          }

          cars.push({
            brand,
            model,
            registrationNumber: registration,
            year: year && Number.isFinite(year) ? year : null,
            fuelType,
            transmission,
            dailyPrice,
            mileage: mileage && Number.isFinite(mileage) ? mileage : null,
            status: status as Car["status"],
            imageUrl: null,
            insuranceExpiryDate: insuranceExpiry,
            technicalVisitExpiryDate: techVisitExpiry,
          });
        }

        resolve({ success: true, cars });
      } catch (error) {
        resolve({ success: false, line: 0, column: "-", message: `Erreur lecture fichier : ${String(error)}` });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Client template ─────────────────────────────────────────────────────────

const CLIENT_HEADERS = [
  "Nom complet",
  "Telephone",
  "CIN",
  "Passeport",
  "Permis",
  "Date permis",
  "Date naissance",
  "Lieu naissance",
  "Nationalite",
  "Adresse",
  "Actif",
];

const CLIENT_EXAMPLE_ROWS = [
  ["Ahmed Ben Ali", "55123456", "12345678", "", "P123456", "2018-05-10", "1990-03-15", "Tunis", "Tunisienne", "Rue Habib Bourguiba", "true"],
  ["Sonia Trabelsi", "22987654", "", "TN9876543", "P654321", "2020-01-20", "1985-07-22", "Sfax", "Tunisienne", "Avenue Farhat Hachad", "true"],
];

export function exportClientsToExcel(clients: Client[], filename = "clients.xlsx"): void {
  const rows = clients.map((client) => [
    client.fullName,
    client.phone,
    client.cin ?? "",
    client.passportNumber ?? "",
    client.drivingLicense ?? "",
    client.drivingLicenseDate ?? "",
    client.birthDate ?? "",
    client.birthPlace ?? "",
    client.nationality ?? "",
    client.address ?? "",
    client.isActive ? "true" : "false",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([CLIENT_HEADERS, ...rows]);
  styleHeaderRow(ws, CLIENT_HEADERS.length, "#10b981");
  ws["!cols"] = CLIENT_HEADERS.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.writeFile(wb, filename);
}

export function downloadClientTemplate(filename = "template_clients.xlsx"): void {
  const ws = XLSX.utils.aoa_to_sheet([CLIENT_HEADERS, ...CLIENT_EXAMPLE_ROWS]);
  styleHeaderRow(ws, CLIENT_HEADERS.length, "#10b981");
  ws["!cols"] = CLIENT_HEADERS.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.writeFile(wb, filename);
}

export interface ImportClientResult {
  success: true;
  clients: CreateClientDto[];
}

export interface ImportClientError {
  success: false;
  line: number;
  column: string;
  message: string;
}

export type ImportClientOutcome = ImportClientResult | ImportClientError;

export function importClientsFromExcel(file: File): Promise<ImportClientOutcome> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as unknown[][];

        if (rows.length < 2) {
          resolve({ success: false, line: 1, column: "-", message: "Fichier vide ou sans données." });
          return;
        }

        const headers = rows[0] as string[];
        if (headers[0] !== "Nom complet" || headers[1] !== "Telephone") {
          resolve({
            success: false,
            line: 1,
            column: "En-tete",
            message: "Le fichier ne correspond pas au template clients. Utilisez le template fourni.",
          });
          return;
        }

        const clients: CreateClientDto[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as string[];
          if (row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "")) continue;

          const lineNum = i + 1;
          const fullName = String(row[0] ?? "").trim();
          const phone = String(row[1] ?? "").trim();
          const cin = String(row[2] ?? "").trim() || null;
          const passportNumber = String(row[3] ?? "").trim() || null;
          const drivingLicense = String(row[4] ?? "").trim() || null;
          const drivingLicenseDate = parseExcelDate(row[5]);
          const birthDate = parseExcelDate(row[6]);
          const birthPlace = String(row[7] ?? "").trim() || null;
          const nationality = String(row[8] ?? "").trim() || null;
          const address = String(row[9] ?? "").trim() || null;
          const isActiveRaw = String(row[10] ?? "true").trim().toLowerCase();
          const isActive = isActiveRaw !== "false";

          if (!fullName) {
            resolve({ success: false, line: lineNum, column: "Nom complet", message: `Ligne ${lineNum} : le nom complet est obligatoire.` });
            return;
          }
          if (!phone) {
            resolve({ success: false, line: lineNum, column: "Telephone", message: `Ligne ${lineNum} : le telephone est obligatoire.` });
            return;
          }
          if (!/^\d{6,15}$/.test(phone.replace(/\s/g, ""))) {
            resolve({ success: false, line: lineNum, column: "Telephone", message: `Ligne ${lineNum} : format telephone invalide "${phone}".` });
            return;
          }

          clients.push({
            fullName,
            phone,
            cin,
            passportNumber,
            drivingLicense,
            drivingLicenseDate,
            cinIssueDate: null,
            cinIssuePlace: null,
            birthDate,
            birthPlace,
            nationality,
            address,
            isActive,
          });
        }

        resolve({ success: true, clients });
      } catch (error) {
        resolve({ success: false, line: 0, column: "-", message: `Erreur lecture fichier : ${String(error)}` });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Rapport CA export ───────────────────────────────────────────────────────

export interface RapportRow {
  date: string;
  reservations: number;
  ca: number;
  encaisse: number;
  reste: number;
}

export function exportRapportToExcel(rows: RapportRow[], period: string, filename = "rapport_ca.xlsx"): void {
  const headers = ["Date", "Reservations", "CA (DT)", "Encaisse (DT)", "Reste (DT)"];
  const data = rows.map((row) => [row.date, row.reservations, row.ca, row.encaisse, row.reste]);

  const totals = rows.reduce(
    (acc, row) => ({ reservations: acc.reservations + row.reservations, ca: acc.ca + row.ca, encaisse: acc.encaisse + row.encaisse, reste: acc.reste + row.reste }),
    { reservations: 0, ca: 0, encaisse: 0, reste: 0 },
  );

  const ws = XLSX.utils.aoa_to_sheet([
    [`Rapport Chiffre d'Affaires - ${period}`],
    [],
    headers,
    ...data,
    [],
    ["TOTAL", totals.reservations, totals.ca, totals.encaisse, totals.reste],
  ]);

  styleHeaderRow(ws, headers.length, "#6366f1", 3);
  ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rapport CA");
  XLSX.writeFile(wb, filename);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function styleHeaderRow(ws: XLSX.WorkSheet, colCount: number, color = "#3b82f6", headerRow = 1): void {
  for (let col = 0; col < colCount; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow - 1, c: col });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      fill: { fgColor: { rgb: color.replace("#", "") } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center" },
    };
  }
}

function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split("/");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && value > 0) {
    // Excel serial date: days since 1899-12-30
    const msPerDay = 86400000;
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + value * msPerDay);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}
