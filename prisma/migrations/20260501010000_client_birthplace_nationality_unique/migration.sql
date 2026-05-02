ALTER TABLE "Client" ADD COLUMN "birthPlace" TEXT;
ALTER TABLE "Client" ADD COLUMN "nationality" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_phone_key" ON "Client"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_cin_key" ON "Client"("cin") WHERE "cin" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Client_passportNumber_key" ON "Client"("passportNumber") WHERE "passportNumber" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Client_drivingLicense_key" ON "Client"("drivingLicense") WHERE "drivingLicense" IS NOT NULL;
