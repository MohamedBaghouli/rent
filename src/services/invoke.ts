import { invoke } from "@tauri-apps/api/core";

type CollectionCommand = "cars" | "clients" | "reservations" | "payments" | "contracts";

const defaultCollections: Record<CollectionCommand, unknown[]> = {
  cars: [
    {
      id: 1,
      brand: "Volkswagen",
      model: "Polo",
      registrationNumber: "204 TUN 8451",
      year: 2022,
      fuelType: "Essence",
      transmission: "Manuelle",
      dailyPrice: 95,
      status: "AVAILABLE",
      mileage: 42000,
      insuranceExpiryDate: new Date().toISOString(),
      technicalVisitExpiryDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  clients: [
    {
      id: 1,
      fullName: "Sami Ben Ali",
      phone: "+216 22 000 000",
      email: "sami@example.com",
      cin: "12345678",
      passportNumber: null,
      drivingLicense: "TN-45896",
      address: "Tunis",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  reservations: [],
  payments: [],
  contracts: [],
};

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    return invoke<T>(command, args);
  }

  return invokeFallback<T>(command, args);
}

function invokeFallback<T>(command: string, args?: Record<string, unknown>): T {
  if (command === "get_dashboard_stats") {
    const cars = readCollection<Record<string, unknown>>("cars");
    const reservations = readCollection<Record<string, unknown>>("reservations");
    const payments = readCollection<Record<string, unknown>>("payments");
    const monthlyRevenue = payments
      .filter((payment) => payment.type === "RENTAL_PAYMENT")
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    return {
      totalCars: cars.length,
      availableCars: cars.filter((car) => car.status === "AVAILABLE").length,
      rentedCars: cars.filter((car) => car.status === "RENTED").length,
      ongoingReservations: reservations.filter((reservation) => reservation.status === "ONGOING").length,
      todayReservations: 0,
      monthlyRevenue,
      overduePayments: 0,
      insuranceAlerts: countDueSoon(cars, "insuranceExpiryDate"),
      technicalVisitAlerts: countDueSoon(cars, "technicalVisitExpiryDate"),
    } as T;
  }

  const getMatch = command.match(/^get_(cars|clients|reservations|payments|contracts)$/);
  if (getMatch) {
    return readCollection(getMatch[1] as CollectionCommand) as T;
  }

  const createMatch = command.match(/^create_(car|client|reservation|payment|contract)$/);
  if (createMatch) {
    const collection = `${createMatch[1]}s` as CollectionCommand;
    const now = new Date().toISOString();
    if (command === "create_reservation") {
      validateFallbackReservation(args?.data as Record<string, unknown>);
    }
    const item = {
      id: Date.now(),
      ...(args?.data as object),
      createdAt: now,
      updatedAt: now,
    };
    const current = readCollection(collection);
    writeCollection(collection, [...current, item]);
    if (command === "create_reservation") {
      createFallbackContract((item as { id: number }).id);
    }
    return item as T;
  }

  const updateMatch = command.match(/^update_(car|client)$/);
  if (updateMatch) {
    const collection = `${updateMatch[1]}s` as CollectionCommand;
    const id = Number(args?.id);
    const data = args?.data as object;
    const updated = readCollection<Record<string, unknown>>(collection).map((item) =>
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item,
    );
    writeCollection(collection, updated);
    return updated.find((item) => item.id === id) as T;
  }

  const deleteMatch = command.match(/^delete_(car|client)$/);
  if (deleteMatch) {
    const collection = `${deleteMatch[1]}s` as CollectionCommand;
    const id = Number(args?.id);
    writeCollection(
      collection,
      readCollection<Record<string, unknown>>(collection).filter((item) => item.id !== id),
    );
    return undefined as T;
  }

  if (command === "change_car_status") {
    const id = Number(args?.id);
    const updated = readCollection<Record<string, unknown>>("cars").map((car) =>
      car.id === id ? { ...car, status: args?.status, updatedAt: new Date().toISOString() } : car,
    );
    writeCollection("cars", updated);
    return updated.find((car) => car.id === id) as T;
  }

  if (command === "update_reservation_status") {
    const id = Number(args?.id);
    const data = args?.data as { status: string; returnMileage?: number; returnFuelLevel?: string };
    const reservations = readCollection<Record<string, unknown>>("reservations");
    const target = reservations.find((reservation) => reservation.id === id);
    const updatedReservations = reservations.map((reservation) =>
      reservation.id === id ? { ...reservation, ...data, updatedAt: new Date().toISOString() } : reservation,
    );
    writeCollection("reservations", updatedReservations);

    if (target) {
      const carStatus = data.status === "ONGOING" ? "RENTED" : ["COMPLETED", "CANCELLED"].includes(data.status) ? "AVAILABLE" : null;
      if (carStatus) {
        invokeFallback("change_car_status", { id: target.carId, status: carStatus });
      }
    }

    return updatedReservations.find((reservation) => reservation.id === id) as T;
  }

  if (command === "generate_contract") {
    return createFallbackContract(Number(args?.reservationId)) as T;
  }

  return [] as T;
}

function readCollection<T = unknown>(collection: CollectionCommand): T[] {
  const key = storageKey(collection);
  const stored = window.localStorage.getItem(key);
  if (!stored) {
    const defaults = defaultCollections[collection] as T[];
    writeCollection(collection, defaults);
    return defaults;
  }

  return JSON.parse(stored) as T[];
}

function writeCollection(collection: CollectionCommand, value: unknown[]) {
  window.localStorage.setItem(storageKey(collection), JSON.stringify(value));
}

function storageKey(collection: CollectionCommand) {
  return `rentaldesk:${collection}`;
}

function createFallbackContract(reservationId: number) {
  const existing = readCollection<Record<string, unknown>>("contracts").find(
    (contract) => contract.reservationId === reservationId,
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const contracts = readCollection<Record<string, unknown>>("contracts");
  const contract = {
    id: Date.now(),
    reservationId,
    contractNumber: `CNT-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(4, "0")}`,
    pdfPath: `contracts/CNT-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(4, "0")}.pdf`,
    status: "GENERATED",
    generatedAt: now,
    signedAt: null,
    createdAt: now,
  };
  writeCollection("contracts", [...contracts, contract]);
  return contract;
}

function validateFallbackReservation(data: Record<string, unknown>) {
  const clientId = Number(data.clientId);
  const carId = Number(data.carId);
  const startDate = String(data.startDate ?? "");
  const endDate = String(data.endDate ?? "");
  const dailyPrice = Number(data.dailyPrice);
  const depositAmount = Number(data.depositAmount);
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();

  if (clientId <= 0) throw new Error("Client obligatoire.");
  if (carId <= 0) throw new Error("Voiture obligatoire.");
  if (!startDate) throw new Error("Date et heure de prise obligatoires.");
  if (!endDate) throw new Error("Date et heure de retour obligatoires.");
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    throw new Error("La date et heure de retour doivent etre apres la prise.");
  }
  if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) throw new Error("Le prix/jour doit etre superieur a 0.");
  if (!Number.isFinite(depositAmount) || depositAmount < 0) throw new Error("La caution doit etre superieure ou egale a 0.");

  const car = readCollection<Record<string, unknown>>("cars").find((item) => item.id === carId);
  if (!car) throw new Error("Voiture introuvable.");
  if (["MAINTENANCE", "UNAVAILABLE"].includes(String(car.status))) {
    throw new Error("Cette voiture n'est pas disponible.");
  }

  const hasConflict = readCollection<Record<string, unknown>>("reservations").some((reservation) => {
    if (Number(reservation.carId) !== carId) return false;
    if (!["RESERVED", "ONGOING"].includes(String(reservation.status))) return false;

    const existingStart = new Date(normalizeLegacyDateTime(String(reservation.startDate ?? ""), "start")).getTime();
    const existingEnd = new Date(normalizeLegacyDateTime(String(reservation.endDate ?? ""), "end")).getTime();

    return existingStart < endTime && existingEnd > startTime;
  });

  if (hasConflict) {
    throw new Error("Cette voiture est deja reservee sur cette periode.");
  }
}

function normalizeLegacyDateTime(value: string, boundary: "start" | "end") {
  if (value.length > 10) return value;
  return boundary === "start" ? `${value}T00:00:00.000` : `${value}T23:59:59.999`;
}

function countDueSoon(items: Record<string, unknown>[], field: string) {
  const now = Date.now();
  const limit = now + 30 * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const value = item[field];
    if (typeof value !== "string" || !value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= now && time <= limit;
  }).length;
}
