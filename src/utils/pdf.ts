import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Contract } from "@/types/contract";

export async function createContractPdf(contract: Contract) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText(`Contrat de location ${contract.contractNumber}`, {
    x: 48,
    y: 780,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.16, 0.32),
  });

  const lines = [
    "Agence: RentalDesk",
    `Reservation: #${contract.reservationId}`,
    "Client: voir fiche reservation",
    "Voiture: voir fiche reservation",
    "Dates: date depart et date retour selon reservation",
    "Prix total: selon reservation",
    "Caution: separee du paiement location",
    "Kilometrage depart: selon fiche depart",
    "Carburant depart: selon fiche depart",
    "",
    "Conditions generales:",
    "- Le client restitue le vehicule dans l'etat initial.",
    "- Les retards, dommages et penalites sont factures par l'agence.",
    "- La caution ne remplace pas le paiement de location.",
    "",
    "Signature agence: ____________________",
    "Signature client: ____________________",
  ];

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 48,
      y: 735 - index * 24,
      size: line.endsWith(":") ? 12 : 10,
      font: line.endsWith(":") ? bold : font,
    });
  });

  return pdfDoc.save();
}
