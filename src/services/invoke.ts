import { invoke } from "@tauri-apps/api/core";

type CollectionCommand = "cars" | "clients" | "reservations" | "payments" | "contracts";

const defaultCollections: Record<CollectionCommand, unknown[]> = {
  cars: [],
  clients: [],
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
    if (command === "create_payment") {
      validateFallbackPayment(args?.data as Record<string, unknown>);
    }
    if (command === "create_client") {
      validateFallbackClient(args?.data as Record<string, unknown>);
    }
    const item = {
      id: Date.now(),
      ...(args?.data as object),
      ...(command === "create_client" ? { isActive: true } : {}),
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
    if (command === "update_client") {
      validateFallbackClient(data as Record<string, unknown>, id);
    }
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

  if (command === "deactivate_client" || command === "reactivate_client") {
    const id = Number(args?.id);
    const isActive = command === "reactivate_client";
    const updated = readCollection<Record<string, unknown>>("clients").map((client) =>
      client.id === id ? { ...client, isActive, updatedAt: new Date().toISOString() } : client,
    );
    writeCollection("clients", updated);
    return updated.find((client) => client.id === id) as T;
  }

  if (command === "delete_reservation") {
    const id = Number(args?.id);
    const reservations = readCollection<Record<string, unknown>>("reservations");
    const reservation = reservations.find((item) => item.id === id);

    writeCollection(
      "payments",
      readCollection<Record<string, unknown>>("payments").filter((payment) => payment.reservationId !== id),
    );
    writeCollection(
      "contracts",
      readCollection<Record<string, unknown>>("contracts").filter((contract) => contract.reservationId !== id),
    );
    writeCollection(
      "reservations",
      reservations.filter((item) => item.id !== id),
    );

    if (reservation?.status === "ONGOING") {
      invokeFallback("change_car_status", { id: reservation.carId, status: "AVAILABLE" });
    }

    return undefined as T;
  }

  if (command === "update_reservation") {
    const id = Number(args?.id);
    const data = args?.data as Record<string, unknown>;
    const reservations = readCollection<Record<string, unknown>>("reservations");
    const target = reservations.find((reservation) => reservation.id === id);
    if (!target) throw new Error("Réservation introuvable.");
    if (target.status !== "EN_ATTENTE") {
      throw new Error("Seules les réservations en attente peuvent être modifiées.");
    }
    validateFallbackReservation(data, id);
    const updated = reservations.map((reservation) =>
      reservation.id === id ? { ...reservation, ...data, updatedAt: new Date().toISOString() } : reservation,
    );
    writeCollection("reservations", updated);
    return updated.find((reservation) => reservation.id === id) as T;
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

function validateFallbackReservation(data: Record<string, unknown>, excludedReservationId?: number) {
  const clientId = Number(data.clientId);
  const secondClientId = data.secondClientId == null ? null : Number(data.secondClientId);
  const carId = Number(data.carId);
  const startDate = String(data.startDate ?? "");
  const endDate = String(data.endDate ?? "");
  const dailyPrice = Number(data.dailyPrice);
  const depositAmount = Number(data.depositAmount);
  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();

  if (clientId <= 0) throw new Error("Client obligatoire.");
  if (secondClientId && secondClientId === clientId) {
    throw new Error("Le deuxième conducteur doit être différent du client principal.");
  }
  if (carId <= 0) throw new Error("Voiture obligatoire.");
  if (!startDate) throw new Error("Date et heure de prise obligatoires.");
  if (!endDate) throw new Error("Date et heure de retour obligatoires.");
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime - startTime < 24 * 60 * 60 * 1000) {
    throw new Error("La durée minimale de location est de 24h.");
  }
  if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) throw new Error("Le prix/jour doit etre superieur a 0.");
  if (!Number.isFinite(depositAmount) || depositAmount < 0) throw new Error("La caution doit etre superieure ou egale a 0.");

  const car = readCollection<Record<string, unknown>>("cars").find((item) => item.id === carId);
  if (!car) throw new Error("Voiture introuvable.");
  if (["MAINTENANCE", "UNAVAILABLE"].includes(String(car.status))) {
    throw new Error("Cette voiture n'est pas disponible.");
  }

  const hasConflict = readCollection<Record<string, unknown>>("reservations").some((reservation) => {
    if (Number(reservation.id) === excludedReservationId) return false;
    if (Number(reservation.carId) !== carId) return false;
    if (!["EN_ATTENTE", "RESERVED", "ONGOING"].includes(String(reservation.status))) return false;

    const existingStart = new Date(normalizeLegacyDateTime(String(reservation.startDate ?? ""), "start")).getTime();
    const existingEnd = new Date(normalizeLegacyDateTime(String(reservation.endDate ?? ""), "end")).getTime();

    return existingStart < endTime && existingEnd > startTime;
  });

  if (hasConflict) {
    throw new Error("Cette voiture est deja reservee sur cette periode.");
  }
}

function validateFallbackClient(data: Record<string, unknown>, currentClientId?: number) {
  const clients = readCollection<Record<string, unknown>>("clients");
  const uniqueFields = [
    ["phone", "Ce téléphone existe déjà."],
    ["cin", "Cette CIN existe déjà."],
    ["passportNumber", "Ce passeport existe déjà."],
    ["drivingLicense", "Ce numéro de permis existe déjà."],
  ] as const;

  for (const [field, message] of uniqueFields) {
    const value = String(data[field] ?? "").trim();
    if (!value) continue;
    const exists = clients.some((client) => Number(client.id) !== currentClientId && String(client[field] ?? "").trim() === value);
    if (exists) throw new Error(message);
  }
}

function validateFallbackPayment(data: Record<string, unknown>) {
  const reservationId = Number(data.reservationId);
  const amount = Number(data.amount);
  const type = String(data.type ?? "");

  if (reservationId <= 0) throw new Error("Réservation obligatoire.");
  if (!Number.isFinite(amount) || (type === "DEPOSIT_REFUND" ? amount < 0 : amount <= 0)) {
    throw new Error(type === "DEPOSIT_REFUND" ? "Le montant à rembourser doit être supérieur ou égal à 0." : "Le montant doit être supérieur à 0.");
  }

  const reservation = readCollection<Record<string, unknown>>("reservations").find((item) => Number(item.id) === reservationId);
  if (!reservation) throw new Error("Réservation introuvable.");

  const reservationPayments = readCollection<Record<string, unknown>>("payments").filter(
    (payment) => Number(payment.reservationId) === reservationId,
  );
  const rentalPaid = sumFallbackPayments(reservationPayments, "RENTAL_PAYMENT");
  const rentalRemaining = Math.max(0, Number(reservation.totalPrice ?? 0) - rentalPaid);
  const depositPaid = sumFallbackPayments(reservationPayments, "DEPOSIT");
  const depositRefunded = sumFallbackPayments(reservationPayments, "DEPOSIT_REFUND");
  const depositRefundDecided = reservationPayments.some((payment) => payment.type === "DEPOSIT_REFUND");
  const depositExpected = Number(reservation.depositAmount ?? 0);
  const refundableDeposit = depositPaid > 0 ? (depositExpected > 0 ? Math.min(depositPaid, depositExpected) : depositPaid) : 0;
  const depositAvailable = Math.max(0, refundableDeposit - depositRefunded);

  if (type === "RENTAL_PAYMENT" && amount > rentalRemaining) {
    throw new Error(`Le paiement location ne peut pas dépasser ${rentalRemaining} DT.`);
  }
  if (type === "RENTAL_PAYMENT" && rentalRemaining <= 0) {
    throw new Error("La location est déjà totalement payée.");
  }

  if (type === "DEPOSIT") {
    if (depositExpected <= 0) throw new Error("Aucune caution n'est prévue pour cette réservation.");
    if (depositPaid > 0) throw new Error("La caution est déjà encaissée pour cette réservation.");
    if (!amountsAreEqual(amount, depositExpected)) {
      throw new Error(`La caution doit être payée en une seule fois : ${depositExpected} DT.`);
    }
  }

  if (type === "DEPOSIT_REFUND") {
    if (depositRefundDecided) throw new Error("Le remboursement de caution est déjà enregistré pour cette réservation.");
    if (amount > depositAvailable) throw new Error(`Le remboursement ne peut pas dépasser ${depositAvailable} DT.`);
  }
}

function sumFallbackPayments(payments: Record<string, unknown>[], type: string) {
  return payments.filter((payment) => payment.type === type).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
}

function amountsAreEqual(first: number, second: number) {
  return Math.abs(first - second) < 0.001;
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
