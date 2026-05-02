import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import type { Car } from "@/types/car";
import { formatCarName, formatRegistrationNumber } from "@/utils/car";
import { formatMoney } from "@/utils/money";

export function CarDetails({ car }: { car: Car }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <CardTitle>{formatRegistrationNumber(car.registrationNumber)}</CardTitle>
          <p className="mt-1 text-lg font-semibold">{formatCarName(car.brand, car.model)}</p>
          <p className="text-sm text-muted-foreground">{formatMoney(car.dailyPrice)} / jour</p>
        </div>
        <StatusBadge status={car.status} />
      </div>
    </Card>
  );
}
