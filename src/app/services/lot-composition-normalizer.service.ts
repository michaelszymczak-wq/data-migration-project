import { Injectable } from '@angular/core';
import { NormalizedLotComposition } from '../models';

/** The resolved header key for each semantic column. */
export interface ColKeys {
  lotCode: string;
  variety: string;
  vintage: string;
  appellation: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function strOrNull(val: unknown): string | null {
  const s = String(val ?? '').trim();
  return s || null;
}

function isNumericLike(val: unknown): boolean {
  const s = String(val ?? '').trim().replace(/%$/, '');
  return s !== '' && !isNaN(Number(s));
}

function parsePct(val: unknown): number | null {
  const s = String(val ?? '').trim().replace(/%$/, '');
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function isEmptyRow(row: Record<string, unknown>, keys: ColKeys): boolean {
  return [keys.lotCode, keys.variety, keys.vintage, keys.appellation]
    .every(k => !String(row[k] ?? '').trim());
}

function isHeaderLike(val: string): boolean {
  const lower = val.toLowerCase();
  return (
    lower === 'lot code' ||
    lower === 'variety' ||
    lower === 'vintage' ||
    lower === 'appellation' ||
    /^column\d+$/i.test(val)
  );
}

function isPctRow(row: Record<string, unknown>, keys: ColKeys): boolean {
  // A percent row has at least one numeric-like value in variety/vintage/appellation
  // AND the lot code column is not a real lot identifier (empty or numeric)
  const lotVal = String(row[keys.lotCode] ?? '').trim();
  if (lotVal && !isNumericLike(lotVal) && !isHeaderLike(lotVal)) {
    return false; // lot code looks like a real identifier → this is a lot row, not pct
  }
  return (
    isNumericLike(row[keys.variety]) ||
    isNumericLike(row[keys.vintage]) ||
    isNumericLike(row[keys.appellation])
  );
}

function isLotRow(row: Record<string, unknown>, keys: ColKeys): boolean {
  const lotVal = String(row[keys.lotCode] ?? '').trim();
  if (!lotVal) return false;
  if (isHeaderLike(lotVal)) return false;
  if (isNumericLike(lotVal)) return false; // purely numeric → looks like a pct row
  return true;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LotCompositionNormalizerService {

  /**
   * Detect which header key maps to each semantic column.
   * Priority: case-insensitive label match → fallback to fixed position (0-indexed 10/11/12/13).
   */
  detectColumns(headers: string[]): ColKeys {
    const find = (...patterns: string[]): string => {
      for (const h of headers) {
        if (patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))) return h;
      }
      return '';
    };

    return {
      lotCode:    find('lot code', 'lot_code') || headers[10] || '',
      variety:    find('variety')               || headers[11] || '',
      vintage:    find('vintage')               || headers[12] || '',
      appellation: find('appellation')          || headers[13] || '',
    };
  }

  /**
   * Main normalization entry point.
   * Pure function: takes rows + headers, returns NormalizedLotComposition[].
   * No side effects, fully testable without Angular TestBed.
   */
  normalize(
    rows: Record<string, unknown>[],
    headers: string[],
    workspaceId: string,
    sourceFileId: string,
  ): NormalizedLotComposition[] {
    const keys = this.detectColumns(headers);
    const consumed = new Set<number>();
    const result: NormalizedLotComposition[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      if (consumed.has(i)) continue;

      const row = rows[i];

      if (isEmptyRow(row, keys)) continue;
      if (!isLotRow(row, keys)) continue;

      // ── Look ahead for a percent row ───────────────────────────────────────
      let pctRow: Record<string, unknown> | null = null;
      let pctIdx: number | null = null;

      // Scan forward, skipping blank rows, stop at first non-blank row
      for (let j = i + 1; j < rows.length; j++) {
        if (isEmptyRow(rows[j], keys)) continue;
        if (isPctRow(rows[j], keys)) {
          pctRow  = rows[j];
          pctIdx  = j;
          consumed.add(j);
        }
        break; // only look at the first non-blank following row
      }

      // ── Build notes ────────────────────────────────────────────────────────
      const notes: string[] = [];

      if (!pctRow) {
        notes.push('missing percent row');
      }

      let varietyPct: number | null = null;
      let vintagePct: number | null = null;
      let appellationPct: number | null = null;

      if (pctRow) {
        varietyPct    = parsePct(pctRow[keys.variety]);
        vintagePct    = parsePct(pctRow[keys.vintage]);
        appellationPct = parsePct(pctRow[keys.appellation]);

        const notNull = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
        if (varietyPct    === null && notNull(pctRow[keys.variety]))
          notes.push(`non-numeric variety%: "${pctRow[keys.variety]}"`);
        if (vintagePct    === null && notNull(pctRow[keys.vintage]))
          notes.push(`non-numeric vintage%: "${pctRow[keys.vintage]}"`);
        if (appellationPct === null && notNull(pctRow[keys.appellation]))
          notes.push(`non-numeric appellation%: "${pctRow[keys.appellation]}"`);
      }

      // ── Vintage: keep as number if purely numeric, else string ─────────────
      const vintageRaw = row[keys.vintage];
      const vintageStr = String(vintageRaw ?? '').trim();
      const vintage: string | number | null =
        vintageStr === '' ? null :
        isNumericLike(vintageRaw) ? Number(vintageStr) :
        vintageStr;

      result.push({
        id:             crypto.randomUUID(),
        workspaceId,
        sourceFileId,
        sourceRowIndex: i,
        lotCode:        String(row[keys.lotCode] ?? '').trim(),
        varietyCode:    strOrNull(row[keys.variety]),
        varietyPct,
        vintage,
        vintagePct,
        appellation:    strOrNull(row[keys.appellation]),
        appellationPct,
        pctRowIndex:    pctIdx,
        notes,
        createdAt:      now,
      });
    }

    return result;
  }
}
