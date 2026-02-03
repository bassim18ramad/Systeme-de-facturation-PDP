import { Company } from "../lib/supabase";
// @ts-ignore
import html2pdf from "html2pdf.js";

type DocumentType = "quote" | "delivery_order" | "invoice";

type DocumentData = {
  type: DocumentType;
  number: string;
  date: string;
  company: Company;
  client: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  total: number;
  include_tva?: boolean;
  stamp_duty?: number;
  notes: string;
  downloadedBy: string;
};

const documentTitles = {
  quote: "DEVIS",
  delivery_order: "BON DE LIVRAISON",
  invoice: "FACTURE",
};

export function downloadDocument(
  data: DocumentData,
  existingWindow?: Window | null,
  mode: "print" | "download" = "print",
) {
  const html = generateHTML(data);

  if (mode === "download") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const styles = Array.from(doc.querySelectorAll("style"))
      .map((s) => s.outerHTML)
      .join("\n");
    const bodyContent = doc.body.innerHTML;

    // Wrap in a container to ensure styles apply correctly
    const content = document.createElement("div");
    content.innerHTML = `${styles}<div class="pdf-content">${bodyContent}</div>`;

    // Configure html2pdf
    const opt = {
      margin: 10,
      filename: `${data.type}_${data.number}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf()
      .from(content)
      .set(opt)
      .save()
      .then(() => {
        // If we used a window for loading status, strict adherence to user request "don't show print dialog"
        // means we shouldn't have opened a window, OR we should close it now.
        // Assuming the caller might handle window closure or we can close existingWindow if provided.
        if (existingWindow) {
          existingWindow.close();
        }
      })
      .catch((err: any) => {
        console.error("PDF generation failed", err);
        if (existingWindow) {
          existingWindow.document.body.innerHTML = `<div style="color:red;padding:20px;">Erreur lors de la génération du PDF: ${err.message || err}</div>`;
        } else {
          alert("Erreur lors de la génération du PDF");
        }
      });

    return;
  }

  // Print mode
  // Use user-provided window if any (legacy), otherwise use hidden iframe
  if (existingWindow) {
    existingWindow.document.open();
    existingWindow.document.write(html);
    existingWindow.document.close();
    setTimeout(() => {
      existingWindow.focus();
      existingWindow.print();
    }, 500);
    return;
  }

  // Hidden iframe logic for seamless printing
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Cleanup after print dialog handles usage
      // Note: in many browsers print() blocks, so this runs after dialog closes
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 500);
  }
}

function generateHTML(data: DocumentData): string {
  const title = documentTitles[data.type];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} ${data.number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 40px;
      background: white;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }

    .logo {
      max-height: 80px;
      max-width: 200px;
    }

    .document-title {
      text-align: right;
    }

    .document-title h1 {
      font-size: 32px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 8px;
    }

    .document-title .number {
      font-size: 18px;
      color: #6b7280;
    }

    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }

    .party {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
    }

    .party h3 {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }

    .party p {
      font-size: 14px;
      color: #374151;
      margin-bottom: 4px;
    }

    .party .name {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .date-info {
      margin-bottom: 30px;
      font-size: 14px;
      color: #6b7280;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    thead {
      background: #f3f4f6;
    }

    th {
      padding: 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }

    th.right {
      text-align: right;
    }

    td {
      padding: 12px;
      font-size: 14px;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
    }

    td.right {
      text-align: right;
    }

    .total-row {
      background: #f9fafb;
      font-weight: 600;
    }

    .total-row td {
      padding: 16px 12px;
      font-size: 16px;
      color: #1f2937;
      border-bottom: none;
    }

    .notes {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .notes h3 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }

    .notes p {
      font-size: 14px;
      color: #6b7280;
    }

    .signature {
      margin-top: 40px;
    }

    .signature p {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .signature img {
      max-height: 80px;
      max-width: 200px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }

    @media print {
      @page {
        size: A4;
        margin: 20mm;
      }
      body {
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${data.company.logo_url ? `<img src="${data.company.logo_url}" alt="Logo" class="logo">` : `<h2>${data.company.name}</h2>`}
    </div>
    <div class="document-title">
      <h1>${title}</h1>
      <div class="number">${data.number}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Entreprise</h3>
      <p class="name">${data.company.name}</p>
    </div>

    <div class="party">
      <h3>Client</h3>
      <p class="name">${data.client.name}</p>
      <p>${data.client.email}</p>
      ${data.client.phone ? `<p>${data.client.phone}</p>` : ""}
      ${data.client.address ? `<p>${data.client.address}</p>` : ""}
    </div>
  </div>

  <div class="date-info">
    Date: ${data.date}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Quantité</th>
        <th class="right">Prix unitaire</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.items
        .map(
          (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${Number(item.unitPrice).toFixed(2)} FDJ</td>
          <td class="right">${Number(item.total).toFixed(2)} FDJ</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="right">Sous-total</td>
        <td class="right">${data.items
          .reduce((sum, item) => sum + Number(item.total), 0)
          .toFixed(2)} FDJ</td>
      </tr>
      ${
        data.include_tva
          ? `
      <tr>
        <td colspan="3" class="right">TVA (10%)</td>
        <td class="right">${(
          data.items.reduce((sum, item) => sum + Number(item.total), 0) * 0.1
        ).toFixed(2)} FDJ</td>
      </tr>
      `
          : ""
      }
      ${
        data.stamp_duty && data.stamp_duty > 0
          ? `
      <tr>
        <td colspan="3" class="right">Frais de timbre</td>
        <td class="right">${Number(data.stamp_duty).toFixed(2)} FDJ</td>
      </tr>
      `
          : ""
      }
      <tr class="total-row">
        <td colspan="3" class="right">Total</td>
        <td class="right">${Number(data.total).toFixed(2)} FDJ</td>
      </tr>
    </tfoot>
  </table>

  ${
    data.notes
      ? `
    <div class="notes">
      <h3>Notes</h3>
      <p>${data.notes}</p>
    </div>
  `
      : ""
  }

  ${
    data.company.signature_url
      ? `
    <div class="signature">
      <p>Signature</p>
      <img src="${data.company.signature_url}" alt="Signature">
    </div>
  `
      : ""
  }

  <div class="footer">
    Document téléchargé par ${data.downloadedBy} le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}
  </div>
</body>
</html>
  `;
}
