import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParseOutput {
  headers: string[];
  previewRows: Record<string, unknown>[];
  rowCount: number;
  errors: string[];
}

const PREVIEW_ROWS = 20;

@Injectable({ providedIn: 'root' })
export class ParseService {

  async parse(file: File): Promise<ParseOutput> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    try {
      if (ext === 'csv' || file.type === 'text/csv' || file.type === 'text/plain') {
        return this.parseCsv(await file.text());
      }
      if (ext === 'xlsx' || ext === 'xls') {
        return this.parseXlsx(await file.arrayBuffer());
      }
      return { headers: [], previewRows: [], rowCount: 0, errors: [`Unsupported file type: .${ext}`] };
    } catch (e) {
      return { headers: [], previewRows: [], rowCount: 0, errors: [String(e)] };
    }
  }

  // ── Full-data helpers (no row cap) used by TransformService ──────────────

  allRowsCsv(text: string): Record<string, unknown>[] {
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    return result.data;
  }

  allRowsXlsx(buffer: ArrayBuffer): Record<string, unknown>[] {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  // ── Preview helpers (capped at PREVIEW_ROWS) ──────────────────────────────

  private parseCsv(text: string): ParseOutput {
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    return {
      headers: result.meta.fields ?? [],
      previewRows: result.data.slice(0, PREVIEW_ROWS),
      rowCount: result.data.length,
      errors: result.errors.map(e => `Row ${e.row ?? '?'}: ${e.message}`),
    };
  }

  private parseXlsx(buffer: ArrayBuffer): ParseOutput {
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { headers: [], previewRows: [], rowCount: 0, errors: ['Workbook is empty'] };
    }
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers: string[] =
      rows.length > 0
        ? Object.keys(rows[0])
        : ((XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0] as string[] | undefined) ?? []);
    return {
      headers,
      previewRows: rows.slice(0, PREVIEW_ROWS),
      rowCount: rows.length,
      errors: [],
    };
  }
}
