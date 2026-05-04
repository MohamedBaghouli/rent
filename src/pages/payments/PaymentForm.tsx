import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Car } from "@/types/car";
import type { Client } from "@/types/client";
import type { CreatePaymentDto, Payment, PaymentType } from "@/types/payment";
import type { Reservation } from "@/types/reservation";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { normalizeClientName } from "@/utils/client";
import { formatShortPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";

type PaymentFormValues = CreatePaymentDto & {
  penaltyReason: string;
};

type PaymentSummary = {
  rentalTotal: number;
  rentalPaid: number;
  rentalRemaining: number;
  depositExpected: number;
  depositCollected: number;
  depositRefunded: number;
  depositRefundDecided: boolean;
  depositAvailable: number;
};

type PaymentFormProps = {
  onSubmit: (data: CreatePaymentDto) => void | Promise<void>;
  reservations: Reservation[];
  payments: Payment[];
  clients: Client[];
  cars: Car[];
  initialReservationId?: number;
  initialType?: PaymentType;
  lockReservation?: boolean;
};

const selectClassName = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm";

const buttonLabels: Record<PaymentType, string> = {
  RENTAL_PAYMENT: "Ajouter paiement",
  DEPOSIT: "Encaisser caution",
  DEPOSIT_REFUND: "Rembourser caution",
  PENALTY: "Ajouter pénalité",
};

const penaltyReasons = ["Retard", "Carburant manquant", "Dommage", "Kilométrage dépassé"];

export function PaymentForm({
  onSubmit,
  reservations,
  payments,
  clients,
  cars,
  initialReservationId = 0,
  initialType = "RENTAL_PAYMENT",
  lockReservation = false,
}: PaymentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    defaultValues: {
      reservationId: initialReservationId,
      amount: 0,
      type: initialType,
      method: "CASH",
      paymentDate: new Date().toISOString().slice(0, 16),
      note: "",
      penaltyReason: "",
    },
  });

  const reservationId = Number(watch("reservationId"));
  const paymentType = watch("type");

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, normalizeClientName(client.fullName)])), [clients]);
  const carsById = useMemo(
    () => new Map(cars.map((car) => [car.id, `${formatCarName(car.brand, car.model)} - ${formatRegistrationNumber(car.registrationNumber)}`])),
    [cars],
  );

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === reservationId),
    [reservationId, reservations],
  );

  useEffect(() => {
    setValue("reservationId", initialReservationId, { shouldValidate: true });
    setValue("type", initialType, { shouldValidate: true });
  }, [initialReservationId, initialType, setValue]);

  const summary = useMemo<PaymentSummary | null>(() => {
    if (!selectedReservation) return null;

    const reservationPayments = payments.filter((payment) => payment.reservationId === selectedReservation.id);
    const rentalPaid = sumPayments(reservationPayments, "RENTAL_PAYMENT");
    const rentalRemaining = Math.max(0, selectedReservation.totalPrice - rentalPaid);
    const depositCollected = sumPayments(reservationPayments, "DEPOSIT");
    const depositRefunded = sumPayments(reservationPayments, "DEPOSIT_REFUND");
    const depositRefundDecided = reservationPayments.some((payment) => payment.type === "DEPOSIT_REFUND");
    const depositLimit = selectedReservation.depositAmount > 0 ? selectedReservation.depositAmount : depositCollected;
    const depositAvailable = depositRefundDecided ? 0 : Math.max(0, Math.min(depositCollected, depositLimit) - depositRefunded);

    return {
      rentalTotal: selectedReservation.totalPrice,
      rentalPaid,
      rentalRemaining,
      depositExpected: selectedReservation.depositAmount,
      depositCollected,
      depositRefunded,
      depositRefundDecided,
      depositAvailable,
    };
  }, [payments, selectedReservation]);

  useEffect(() => {
    if (!summary) {
      setValue("amount", 0, { shouldValidate: true });
      return;
    }

    if (paymentType === "RENTAL_PAYMENT") {
      setValue("amount", summary.rentalRemaining, { shouldValidate: true });
    }

    if (paymentType === "DEPOSIT") {
      setValue("amount", summary.depositExpected, { shouldValidate: true });
    }

    if (paymentType === "DEPOSIT_REFUND") {
      setValue("amount", summary.depositAvailable, { shouldValidate: true });
    }
  }, [paymentType, setValue, summary]);

  useEffect(() => {
    if (!summary) return;

    if (
      (paymentType === "RENTAL_PAYMENT" && summary.rentalRemaining <= 0) ||
      (paymentType === "DEPOSIT" && (summary.depositCollected > 0 || summary.depositExpected <= 0))
    ) {
      setValue("type", getNextAvailablePaymentType(summary), {
        shouldValidate: true,
      });
    }

    if (paymentType === "DEPOSIT_REFUND" && (summary.depositAvailable <= 0 || summary.depositRefundDecided)) {
      setValue("type", getNextAvailablePaymentType(summary), { shouldValidate: true });
    }
  }, [paymentType, setValue, summary]);

  const amountLabel =
    paymentType === "DEPOSIT_REFUND"
      ? "Montant à rembourser"
      : paymentType === "PENALTY"
        ? "Montant de la pénalité"
        : paymentType === "DEPOSIT"
          ? "Montant caution"
          : "Montant payé";
  const amountMax =
    paymentType === "RENTAL_PAYMENT"
      ? summary?.rentalRemaining
      : paymentType === "DEPOSIT_REFUND"
        ? summary?.depositAvailable
        : paymentType === "DEPOSIT"
          ? summary?.depositExpected
        : undefined;

  function submitForm(values: PaymentFormValues) {
    const { penaltyReason, note, ...data } = values;
    const cleanedNote = note?.trim() ?? "";
    const paymentNote =
      values.type === "PENALTY"
        ? [`Motif: ${penaltyReason.trim()}`, cleanedNote].filter(Boolean).join(" - ")
        : cleanedNote;
    const amount = data.type === "DEPOSIT" && summary ? summary.depositExpected : Number(data.amount);

    return onSubmit({
      ...data,
      amount,
      reservationId: Number(data.reservationId),
      paymentDate: data.paymentDate ? new Date(data.paymentDate).toISOString() : new Date().toISOString(),
      note: paymentNote || null,
    });
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
      <div className="md:col-span-2">
        <Label>Réservation</Label>
        {lockReservation && selectedReservation ? (
          <>
            <input
              type="hidden"
              {...register("reservationId", {
                valueAsNumber: true,
                validate: (value) => Number(value) > 0 || "Sélectionnez une réservation.",
              })}
            />
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/60 px-3 text-sm font-medium">
              {getReservationLabel(selectedReservation, clientsById, carsById)}
            </div>
          </>
        ) : (
          <select
            className={selectClassName}
            {...register("reservationId", {
              valueAsNumber: true,
              validate: (value) => Number(value) > 0 || "Sélectionnez une réservation.",
            })}
          >
            <option value={0}>Sélectionner</option>
            {reservations.map((reservation) => (
              <option key={reservation.id} value={reservation.id}>
                {getReservationLabel(reservation, clientsById, carsById)}
              </option>
            ))}
          </select>
        )}
        {errors.reservationId && <p className="mt-1 text-xs text-destructive">{errors.reservationId.message}</p>}
      </div>

      {summary && (
        <div className="md:col-span-2 rounded-md border border-border bg-muted/60 p-3 text-sm">
          <p className="font-medium">{getTypeHint(paymentType, summary)}</p>
        </div>
      )}

      <div>
        <Label>Type de paiement</Label>
        <select className={selectClassName} {...register("type")}>
          <option disabled={Boolean(summary && summary.rentalRemaining <= 0)} value="RENTAL_PAYMENT">
            Paiement location
          </option>
          <option disabled={Boolean(summary && (summary.depositCollected > 0 || summary.depositExpected <= 0))} value="DEPOSIT">
            Caution
          </option>
          <option disabled={Boolean(summary && (summary.depositAvailable <= 0 || summary.depositRefundDecided))} value="DEPOSIT_REFUND">
            Remboursement caution
          </option>
          <option value="PENALTY">Pénalité</option>
        </select>
      </div>

      <div>
        <Label>{amountLabel}</Label>
        <Input
          max={amountMax}
          min={paymentType === "DEPOSIT_REFUND" ? "0" : "0.001"}
          readOnly={paymentType === "DEPOSIT"}
          step="0.001"
          type="number"
          {...register("amount", {
            valueAsNumber: true,
            validate: (value) => validateAmount(value, paymentType, summary),
          })}
        />
        {paymentType === "DEPOSIT" && (
          <p className="mt-1 text-xs text-muted-foreground">La caution est encaissée une seule fois au montant prévu.</p>
        )}
        {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
      </div>

      <div>
        <Label>Méthode de paiement</Label>
        <select className={selectClassName} {...register("method")}>
          <option value="CASH">Espèces</option>
          <option value="CARD">Carte</option>
          <option value="BANK_TRANSFER">Virement</option>
          <option value="CHECK">Chèque</option>
        </select>
      </div>

      <div>
        <Label>Date et heure</Label>
        <Input type="datetime-local" {...register("paymentDate")} />
      </div>

      {paymentType === "PENALTY" && (
        <div className="md:col-span-2">
          <Label>Motif de pénalité</Label>
          <select
            className={selectClassName}
            {...register("penaltyReason", {
              validate: (value) =>
                paymentType !== "PENALTY" || value.trim().length > 0 || "Indiquez le motif de pénalité.",
            })}
          >
            <option value="">Sélectionner</option>
            {penaltyReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          {errors.penaltyReason && <p className="mt-1 text-xs text-destructive">{errors.penaltyReason.message}</p>}
        </div>
      )}

      <div className="md:col-span-2">
        <Label>Note / commentaire</Label>
        <Input {...register("note")} />
      </div>

      <div className="md:col-span-2 rounded-md border border-border bg-white p-4 text-sm">
        <h3 className="mb-3 font-semibold">Résumé</h3>
        {summary ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            <SummaryItem label="Prix location" value={summary.rentalTotal} />
            <SummaryItem label="Déjà payé" value={summary.rentalPaid} />
            <SummaryItem label="Reste à payer" value={summary.rentalRemaining} />
            <SummaryItem label="Caution encaissée" value={summary.depositCollected} />
            <SummaryItem label="Caution remboursée" value={summary.depositRefunded} />
            <SummaryItem label="Caution disponible" value={summary.depositAvailable} />
          </dl>
        ) : (
          <p className="text-muted-foreground">Aucune réservation sélectionnée.</p>
        )}
      </div>

      <div className="md:col-span-2 flex justify-end">
        <Button type="submit">{buttonLabels[paymentType]}</Button>
      </div>
    </form>
  );
}

function sumPayments(payments: Payment[], type: PaymentType) {
  return payments.filter((payment) => payment.type === type).reduce((sum, payment) => sum + payment.amount, 0);
}

function validateAmount(value: number, paymentType: PaymentType, summary: PaymentSummary | null) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || (paymentType === "DEPOSIT_REFUND" ? amount < 0 : amount <= 0)) {
    return paymentType === "DEPOSIT_REFUND"
      ? "Le montant à rembourser doit être supérieur ou égal à 0."
      : "Le montant doit être supérieur à 0.";
  }

  if (paymentType === "RENTAL_PAYMENT" && summary && amount > summary.rentalRemaining) {
    if (summary.rentalRemaining <= 0) {
      return "La location est déjà totalement payée.";
    }

    return `Le paiement location ne peut pas dépasser ${formatMoney(summary.rentalRemaining)}.`;
  }

  if (paymentType === "DEPOSIT" && summary) {
    if (summary.depositExpected <= 0) {
      return "Aucune caution n'est prévue pour cette réservation.";
    }

    if (summary.depositCollected > 0) {
      return "La caution est déjà encaissée pour cette réservation.";
    }

    if (!amountsAreEqual(amount, summary.depositExpected)) {
      return `La caution doit être payée en une seule fois : ${formatMoney(summary.depositExpected)}.`;
    }
  }

  if (paymentType === "DEPOSIT_REFUND" && summary) {
    if (summary.depositRefundDecided) {
      return "Le remboursement de caution est déjà enregistré pour cette réservation.";
    }

    if (amount > summary.depositAvailable) {
      return `Le remboursement ne peut pas dépasser ${formatMoney(summary.depositAvailable)}.`;
    }
  }

  return true;
}

function getTypeHint(paymentType: PaymentType, summary: PaymentSummary) {
  if (paymentType === "RENTAL_PAYMENT") {
    return `Reste à payer : ${formatMoney(summary.rentalRemaining)}`;
  }

  if (paymentType === "DEPOSIT") {
    if (summary.depositCollected > 0) {
      return `Caution déjà encaissée : ${formatMoney(summary.depositCollected)}`;
    }

    return `Caution demandée : ${formatMoney(summary.depositExpected)}`;
  }

  if (paymentType === "DEPOSIT_REFUND") {
    if (summary.depositRefundDecided) {
      return `Remboursement déjà enregistré : ${formatMoney(summary.depositRefunded)}`;
    }

    return `Caution disponible à rembourser : ${formatMoney(summary.depositAvailable)}`;
  }

  return "Motif de pénalité obligatoire.";
}

function amountsAreEqual(first: number, second: number) {
  return Math.abs(first - second) < 0.001;
}

function getNextAvailablePaymentType(summary: PaymentSummary): PaymentType {
  if (summary.rentalRemaining > 0) return "RENTAL_PAYMENT";
  if (summary.depositCollected <= 0 && summary.depositExpected > 0) return "DEPOSIT";
  if (summary.depositAvailable > 0 && !summary.depositRefundDecided) return "DEPOSIT_REFUND";
  return "PENALTY";
}

function getReservationLabel(
  reservation: Reservation,
  clientsById: Map<number, string>,
  carsById: Map<number, string>,
) {
  const client = clientsById.get(reservation.clientId) ?? `Client #${reservation.clientId}`;
  const secondClient = reservation.secondClientId ? clientsById.get(reservation.secondClientId) : undefined;
  const car = carsById.get(reservation.carId) ?? `Voiture #${reservation.carId}`;
  return `${client}${secondClient ? ` / 2e conducteur: ${secondClient}` : ""} - ${car} - ${formatShortPeriod(reservation.startDate, reservation.endDate)}`;
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{formatMoney(value)}</dd>
    </div>
  );
}
