import ExcelJS from 'exceljs';
import type { Cell, Grid } from './parse';

// ExcelJS adapter: turns an .xlsx buffer into plain grids for parseFinancials.
//
// Formula cells carry the value Excel last calculated. Some generators only store
// a cached result when it is non-zero, so a formula with no cached result is read
// as 0 — that is what the CAA book's totals reconcile to. The count is returned so
// the desk can see it happened.

// Sheets we never read (large raw data); skipping them keeps parsing fast.
const SKIP = new Set(['gl', 'trial balance', 'key']);

function cellValue(v: ExcelJS.CellValue, onMissingResult: () => void): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v) {
      const r = (v as { result?: unknown }).result;
      if (r === undefined || r === null) {
        onMissingResult();
        return 0;
      }
      if (r instanceof Date) return r.toISOString().slice(0, 10);
      if (typeof r === 'object') return null; // { error: '#REF!' }
      return r as Cell;
    }
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String((v as { text: unknown }).text);
    if ('error' in v) return null;
  }
  return null;
}

export async function readWorkbook(buffer: ArrayBuffer): Promise<{ grids: Grid[]; formulasWithoutResult: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  let missing = 0;
  const grids: Grid[] = [];
  for (const ws of wb.worksheets) {
    if (SKIP.has(ws.name.trim().toLowerCase())) continue;
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      const cells: Cell[] = [];
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        cells[c - 1] = cellValue(cell.value, () => missing++);
      });
      for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = null;
      rows[r - 1] = cells;
    });
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    grids.push({ name: ws.name, rows });
  }
  return { grids, formulasWithoutResult: missing };
}
