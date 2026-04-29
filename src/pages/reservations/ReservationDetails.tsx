import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import type { Reservation } from "@/types/reservation";
import { formatPeriod } from "@/utils/date";
import { formatMoney } from "@/utils/money";

export function ReservationDetails({ reservation }: { reservation: Reservation }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <CardTitle>Réservation #{reservation.id}</CardTitle>
          <p className="mt-2 text-sm">
            {formatPeriod(reservation.startDate, reservation.endDate)}
          </p>
          <p className="text-sm text-muted-foreground">{formatMoney(reservation.totalPrice)}</p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>
    </Card>
  );
}
