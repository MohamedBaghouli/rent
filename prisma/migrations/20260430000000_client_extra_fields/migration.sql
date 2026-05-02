-- AlterTable Client: remove email, add driving license date, CIN issue info, birthdate
ALTER TABLE "Client" ADD COLUMN "drivingLicenseDate" TEXT;
ALTER TABLE "Client" ADD COLUMN "cinIssueDate" TEXT;
ALTER TABLE "Client" ADD COLUMN "cinIssuePlace" TEXT;
ALTER TABLE "Client" ADD COLUMN "birthDate" TEXT;
