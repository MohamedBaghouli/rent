-- Existing startDate/endDate columns are already DateTime-capable.
-- Normalize legacy date-only reservations so availability checks can use exact date-time overlap.
UPDATE "Reservation"
SET "startDate" = "startDate" || 'T00:00:00.000Z'
WHERE length("startDate") = 10;

UPDATE "Reservation"
SET "endDate" = "endDate" || 'T23:59:59.999Z'
WHERE length("endDate") = 10;
