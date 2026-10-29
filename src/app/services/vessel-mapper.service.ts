import { Injectable } from '@angular/core';
import Papa from 'papaparse';

export interface VesselMapperConfig {
  colorDerivation: 'none' | 'last_contained';
  duplicateHandling: 'include_all' | 'keep_first' | 'keep_last';
  defaultVesselType: string;
  unmatchedAction: 'leave_blank' | 'use_closest';
}

export interface UnmatchedRow {
  rowNumber: number;
  vinx2Field: string;
  vinx2Value: string;
  innovintField: string;
  closestMatch: string;
  actionTaken: string;
}

export interface MapResult {
  rows: Record<string, string>[];
  unmatched: UnmatchedRow[];
  totalInput: number;
  duplicateCodes: string[];
}

// ─── User-editable abbreviation expansion table ──────────────────────────────
// Keys are lowercase source values; values are the expanded canonical forms.
// Add/edit entries here to handle new abbreviations in your VINx2 data.
const ABBREV_MAP: Record<string, string> = {
  'french': 'French Oak',
  'american': 'American Oak',
  'hungarian': 'Hungarian Oak',
  'european': 'European Oak',
  'slavonian': 'Slavonian Oak',
  'bdx': 'Bordeaux',
  'bdx.': 'Bordeaux',
  'bgy': 'Burgundy',
  'burg': 'Burgundy',
  'hogs': 'Hogshead',
  'punc': 'Puncheon',
};
// ─────────────────────────────────────────────────────────────────────────────

const INNOVINT_HEADERS = [
  'Vessel code',
  'Vessel type',
  'Capacity (vol)',
  'Bottle Type',
  'Capacity (bottles)',
  'Year first used',
  'Cooper',
  'Style',
  'Wood',
  'Forest',
  'Toast',
  'Color',
  'Tags',
  'Owners',
] as const;

// Blank/dash sentinel values that should be treated as "no value"
const BLANK_SENTINELS = new Set(['', '--', 'No', 'N/A', 'no', 'n/a']);

/** Standard DP Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

@Injectable({ providedIn: 'root' })
export class VesselMapperService {

  /**
   * Parse the InnoVint Attribute Table CSV and return a map of
   * column-name → array of non-empty valid values.
   */
  parseAttrTable(csv: string): Record<string, string[]> {
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const targetCols = ['VESSEL_TYPE', 'COOPER', 'WOOD', 'WOOD/FOREST', 'TOAST', 'BARREL STYLE', 'YEAR FIRST USED', 'COLOR'];
    const result: Record<string, string[]> = {};

    for (const col of targetCols) {
      const values = new Set<string>();
      for (const row of parsed.data) {
        const v = (row[col] ?? '').trim();
        if (v && !BLANK_SENTINELS.has(v)) {
          values.add(v);
        }
      }
      result[col] = Array.from(values);
    }
    return result;
  }

  /**
   * Attempt to fuzzy-match `value` against `validList`.
   * Returns matched string + method description, or null if no match.
   * Always sets `closestOut` to the best candidate string for the unmatched report.
   */
  fuzzyMatch(
    value: string,
    validList: string[],
    _fieldName: string,
    closestOut: { value: string } = { value: '' }
  ): { matched: string; method: string } | null {
    const trimmed = value.trim();

    // 1. Blank/sentinel guard
    if (BLANK_SENTINELS.has(trimmed)) {
      return null;
    }

    if (validList.length === 0) {
      return null;
    }

    // Precompute lowercase for reuse
    const lower = trimmed.toLowerCase();

    // 2. Exact match
    const exact = validList.find(v => v === trimmed);
    if (exact) {
      closestOut.value = exact;
      return { matched: exact, method: 'exact' };
    }

    // 3. Case-insensitive match
    const ci = validList.find(v => v.toLowerCase() === lower);
    if (ci) {
      closestOut.value = ci;
      return { matched: ci, method: 'case-insensitive' };
    }

    // 4. Abbreviation expansion — lookup, then retry exact/CI
    const expanded = ABBREV_MAP[lower];
    if (expanded) {
      const expLower = expanded.toLowerCase();
      const expExact = validList.find(v => v === expanded);
      if (expExact) {
        closestOut.value = expExact;
        return { matched: expExact, method: 'abbreviation+exact' };
      }
      const expCi = validList.find(v => v.toLowerCase() === expLower);
      if (expCi) {
        closestOut.value = expCi;
        return { matched: expCi, method: 'abbreviation+ci' };
      }
    }

    // 5. Substring match — prefer the longer/more-specific candidate
    const subMatches = validList.filter(v => {
      const vl = v.toLowerCase();
      return lower.includes(vl) || vl.includes(lower);
    });
    if (subMatches.length > 0) {
      // Prefer the valid entry that is most specific (longest)
      subMatches.sort((a, b) => b.length - a.length);
      closestOut.value = subMatches[0];
      return { matched: subMatches[0], method: 'substring' };
    }

    // 6. Levenshtein edit distance — accept if dist ≤ 0.35 × max(len)
    let bestDist = Infinity;
    let bestCandidate = '';
    for (const v of validList) {
      const dist = levenshtein(lower, v.toLowerCase());
      if (dist < bestDist) {
        bestDist = dist;
        bestCandidate = v;
      }
    }
    closestOut.value = bestCandidate;

    const threshold = 0.35 * Math.max(trimmed.length, bestCandidate.length);
    if (bestDist <= threshold) {
      return { matched: bestCandidate, method: 'levenshtein' };
    }

    // 7. No match
    return null;
  }

  /** Map all VINx2 rows to InnoVint format. */
  mapAll(
    rows: Record<string, string>[],
    attrMap: Record<string, string[]>,
    config: VesselMapperConfig
  ): MapResult {
    const unmatched: UnmatchedRow[] = [];
    const mapped: Record<string, string>[] = [];
    const codeCount = new Map<string, number>();

    // First pass: count codes for duplicate detection
    for (const row of rows) {
      const code = (row['Code'] ?? '').trim();
      if (code) codeCount.set(code, (codeCount.get(code) ?? 0) + 1);
    }
    const duplicateCodes = Array.from(codeCount.entries())
      .filter(([, count]) => count > 1)
      .map(([code]) => code);
    const duplicateSet = new Set(duplicateCodes);

    // Track which duplicate code instances we've seen (for keep_first/keep_last)
    const seenCodes = new Map<string, number>(); // code → times seen so far

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const out: Record<string, string> = {};
      for (const h of INNOVINT_HEADERS) out[h] = '';

      // ── Vessel code (free text) ──────────────────────────────────────
      const code = (row['Code'] ?? '').trim();
      out['Vessel code'] = code;

      // Duplicate handling
      if (duplicateSet.has(code)) {
        const seen = (seenCodes.get(code) ?? 0) + 1;
        seenCodes.set(code, seen);
        const total = codeCount.get(code)!;
        if (config.duplicateHandling === 'keep_first' && seen > 1) continue;
        if (config.duplicateHandling === 'keep_last' && seen < total) continue;
      }

      // ── Vessel type ──────────────────────────────────────────────────
      {
        const src = (row['Vessel type'] ?? '').trim();
        const closest: { value: string } = { value: '' };
        const match = this.fuzzyMatch(src, attrMap['VESSEL_TYPE'] ?? [], 'Vessel type', closest);
        if (match) {
          out['Vessel type'] = match.matched;
        } else if (src && !BLANK_SENTINELS.has(src)) {
          out['Vessel type'] = config.unmatchedAction === 'use_closest' && closest.value
            ? closest.value
            : config.defaultVesselType;
          unmatched.push({
            rowNumber: rowNum, vinx2Field: 'Vessel type', vinx2Value: src,
            innovintField: 'Vessel type', closestMatch: closest.value,
            actionTaken: config.unmatchedAction === 'use_closest' && closest.value
              ? `Used closest: ${closest.value}` : `Used default: ${config.defaultVesselType}`,
          });
        } else {
          out['Vessel type'] = config.defaultVesselType;
        }
      }

      // ── Capacity (vol) ───────────────────────────────────────────────
      {
        const src = (row['Capacity (L)'] ?? '').trim();
        out['Capacity (vol)'] = (!src || src === '0') ? '' : src;
      }

      // ── Bottle Type / Capacity (bottles) / Tags — always blank ──────
      out['Bottle Type'] = '';
      out['Capacity (bottles)'] = '';
      out['Tags'] = '';

      // ── Year first used ──────────────────────────────────────────────
      {
        const src = (row['Year'] ?? '').trim();
        if (src && !BLANK_SENTINELS.has(src)) {
          // 2-digit year expansion
          const num = parseInt(src, 10);
          const expanded = (!isNaN(num) && num >= 0 && num <= 99)
            ? String(2000 + num) : src;

          const closest: { value: string } = { value: '' };
          const match = this.fuzzyMatch(expanded, attrMap['YEAR FIRST USED'] ?? [], 'Year first used', closest);
          if (match) {
            out['Year first used'] = match.matched;
          } else {
            // Years are often free-text numbers not in the list; use value directly
            out['Year first used'] = expanded;
            if (attrMap['YEAR FIRST USED']?.length) {
              unmatched.push({
                rowNumber: rowNum, vinx2Field: 'Year', vinx2Value: src,
                innovintField: 'Year first used', closestMatch: closest.value,
                actionTaken: config.unmatchedAction === 'use_closest' && closest.value
                  ? `Used closest: ${closest.value}` : `Used value: ${expanded}`,
              });
            }
          }
        }
      }

      // ── Cooper ───────────────────────────────────────────────────────
      {
        const src = (row['Cooper'] ?? '').trim();
        if (src && !BLANK_SENTINELS.has(src)) {
          const closest: { value: string } = { value: '' };
          const match = this.fuzzyMatch(src, attrMap['COOPER'] ?? [], 'Cooper', closest);
          if (match) {
            out['Cooper'] = match.matched;
          } else {
            out['Cooper'] = config.unmatchedAction === 'use_closest' && closest.value
              ? closest.value : '';
            unmatched.push({
              rowNumber: rowNum, vinx2Field: 'Cooper', vinx2Value: src,
              innovintField: 'Cooper', closestMatch: closest.value,
              actionTaken: config.unmatchedAction === 'use_closest' && closest.value
                ? `Used closest: ${closest.value}` : 'Left blank',
            });
          }
        }
      }

      // ── Style (from Description → BARREL STYLE) ──────────────────────
      {
        const src = (row['Description'] ?? '').trim();
        if (src && !BLANK_SENTINELS.has(src)) {
          const closest: { value: string } = { value: '' };
          const match = this.fuzzyMatch(src, attrMap['BARREL STYLE'] ?? [], 'Style', closest);
          if (match) {
            out['Style'] = match.matched;
          } else {
            out['Style'] = config.unmatchedAction === 'use_closest' && closest.value
              ? closest.value : '';
            unmatched.push({
              rowNumber: rowNum, vinx2Field: 'Description', vinx2Value: src,
              innovintField: 'Style', closestMatch: closest.value,
              actionTaken: config.unmatchedAction === 'use_closest' && closest.value
                ? `Used closest: ${closest.value}` : 'Left blank',
            });
          }
        }
      }

      // ── Wood (from Oak type → WOOD + abbreviation expansion) ─────────
      {
        const src = (row['Oak type'] ?? '').trim();
        if (src && !BLANK_SENTINELS.has(src)) {
          const closest: { value: string } = { value: '' };
          const match = this.fuzzyMatch(src, attrMap['WOOD'] ?? [], 'Wood', closest);
          if (match) {
            out['Wood'] = match.matched;
          } else {
            out['Wood'] = config.unmatchedAction === 'use_closest' && closest.value
              ? closest.value : '';
            unmatched.push({
              rowNumber: rowNum, vinx2Field: 'Oak type', vinx2Value: src,
              innovintField: 'Wood', closestMatch: closest.value,
              actionTaken: config.unmatchedAction === 'use_closest' && closest.value
                ? `Used closest: ${closest.value}` : 'Left blank',
            });
          }
        }
      }

      // ── Forest (from Forest → WOOD/FOREST) ───────────────────────────
      {
        const src = (row['Forest'] ?? '').trim();
        if (src && !BLANK_SENTINELS.has(src)) {
          const closest: { value: string } = { value: '' };
          const match = this.fuzzyMatch(src, attrMap['WOOD/FOREST'] ?? [], 'Forest', closest);
          if (match) {
            out['Forest'] = match.matched;
          } else {
            out['Forest'] = config.unmatchedAction === 'use_closest' && closest.value
              ? closest.value : '';
            unmatched.push({
              rowNumber: rowNum, vinx2Field: 'Forest', vinx2Value: src,
              innovintField: 'Forest', closestMatch: closest.value,
              actionTaken: config.unmatchedAction === 'use_closest' && closest.value
                ? `Used closest: ${closest.value}` : 'Left blank',
            });
          }
        }
      }

      // ── Toast (from Toasting → TOAST) ────────────────────────────────
      {
        const src = (row['Toasting'] ?? '').trim();
        if (src && !BLANK_SENTINELS.has(src)) {
          const closest: { value: string } = { value: '' };
          const match = this.fuzzyMatch(src, attrMap['TOAST'] ?? [], 'Toast', closest);
          if (match) {
            out['Toast'] = match.matched;
          } else {
            out['Toast'] = config.unmatchedAction === 'use_closest' && closest.value
              ? closest.value : '';
            unmatched.push({
              rowNumber: rowNum, vinx2Field: 'Toasting', vinx2Value: src,
              innovintField: 'Toast', closestMatch: closest.value,
              actionTaken: config.unmatchedAction === 'use_closest' && closest.value
                ? `Used closest: ${closest.value}` : 'Left blank',
            });
          }
        }
      }

      // ── Color (from Last contained → COLOR) ──────────────────────────
      if (config.colorDerivation === 'last_contained') {
        const src = (row['Last contained'] ?? '').trim();
        if (src && !BLANK_SENTINELS.has(src)) {
          const closest: { value: string } = { value: '' };
          const match = this.fuzzyMatch(src, attrMap['COLOR'] ?? [], 'Color', closest);
          if (match) {
            out['Color'] = match.matched;
          } else {
            out['Color'] = config.unmatchedAction === 'use_closest' && closest.value
              ? closest.value : '';
            unmatched.push({
              rowNumber: rowNum, vinx2Field: 'Last contained', vinx2Value: src,
              innovintField: 'Color', closestMatch: closest.value,
              actionTaken: config.unmatchedAction === 'use_closest' && closest.value
                ? `Used closest: ${closest.value}` : 'Left blank',
            });
          }
        }
      }

      // ── Owners (free text) ────────────────────────────────────────────
      out['Owners'] = (row['Owner'] ?? '').trim();

      mapped.push(out);
    }

    return {
      rows: mapped,
      unmatched,
      totalInput: rows.length,
      duplicateCodes,
    };
  }
}
