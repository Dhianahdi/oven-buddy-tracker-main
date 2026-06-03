import type { Operation, Oven } from "./oven-queries";

type HistoryRow = Operation & { oven: Oven };

const HEADERS = [
  "Four (interne)", "Four (série)", "Statut", "Demandeur", "Réalisateur",
  "Projet", "CDC", "Essai", "Spécification", "Type", "Section", "Couleur",
  "Date début", "Heure début", "Date fin", "Heure fin", "Notes",
];

function rowToValues(op: HistoryRow): string[] {
  return [
    op.oven?.internal_number ?? "",
    op.oven?.serial_number ?? "",
    op.status === "active" ? "En cours" : "Terminée",
    op.demandeur ?? "",
    op.realisateur ?? "",
    op.projet ?? "",
    op.cdc ?? "",
    op.essai ?? "",
    op.specification ?? "",
    op.type ?? "",
    op.section ?? "",
    op.couleur ?? "",
    op.date_debut ?? "",
    op.heure_debut ?? "",
    op.date_fin ?? "",
    op.heure_fin ?? "",
    op.notes ?? "",
  ];
}

function escapeCSV(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function exportCSV(rows: HistoryRow[], filename = "historique.csv") {
  const lines = [
    HEADERS.map(escapeCSV).join(","),
    ...rows.map((r) => rowToValues(r).map(escapeCSV).join(",")),
  ];
  const bom = "﻿";
  const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export function exportPDF(rows: HistoryRow[], filename = "historique.pdf") {
  const colWidths = [60, 60, 55, 80, 80, 80, 50, 40, 80, 60, 50, 50, 65, 60, 65, 60, 100];
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const styles = `
    body { font-family: Arial, sans-serif; font-size: 8px; color: #111; }
    h1 { font-size: 14px; margin: 0 0 4px; }
    p.sub { font-size: 9px; color: #666; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1e293b; color: #fff; padding: 5px 4px; text-align: left; font-size: 7px; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
    td { padding: 4px 4px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge-active { display:inline-block; background:#fef3c7; color:#b45309; border-radius:4px; padding:1px 5px; font-size:7px; font-weight:700; }
    .badge-done   { display:inline-block; background:#dcfce7; color:#15803d; border-radius:4px; padding:1px 5px; font-size:7px; font-weight:700; }
    @media print { @page { size: landscape; margin: 12mm; } }
  `;

  const theadCells = HEADERS.map((h, i) =>
    `<th style="min-width:${colWidths[i]}px">${h}</th>`
  ).join("");

  const tbodyRows = rows.map((op) => {
    const vals = rowToValues(op);
    const statusCell = op.status === "active"
      ? `<span class="badge-active">En cours</span>`
      : `<span class="badge-done">Terminée</span>`;
    const cells = vals.map((v, i) =>
      `<td>${i === 2 ? statusCell : (v || "<span style='color:#aaa'>—</span>")}</td>`
    ).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  const now = new Date().toLocaleString("fr-FR");
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Historique des opérations</title>
  <style>${styles}</style>
</head>
<body>
  <h1>Historique des opérations</h1>
  <p class="sub">Exporté le ${now} · ${rows.length} opération${rows.length > 1 ? "s" : ""}</p>
  <table style="min-width:${totalWidth}px">
    <thead><tr>${theadCells}</tr></thead>
    <tbody>${tbodyRows}</tbody>
  </table>
  <script>window.onload=()=>{window.print();}</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    triggerDownload(blob, filename.replace(".pdf", ".html"));
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
