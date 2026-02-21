import { LotCompositionNormalizerService } from './lot-composition-normalizer.service';

/**
 * Unit tests for LotCompositionNormalizerService.
 * Uses plain Jasmine — no Angular TestBed needed because the service is a pure function.
 */

// ── Synthetic test data helpers ───────────────────────────────────────────────

/** Headers where lot/variety/vintage/appellation appear at 0-indexed positions 10-13. */
const FIXED_HEADERS: string[] = [
  'Col1','Col2','Col3','Col4','Col5','Col6','Col7','Col8','Col9','Col10',
  'Lot Code', 'Variety', 'Vintage', 'Appellation', 'Col15',
];

/** Headers using semantic labels — detectable by name. */
const NAMED_HEADERS: string[] = [
  'X','Y','Z',
  'Lot Code', 'Variety', 'Vintage', 'Appellation',
];

function makeRow(
  lotCode: string,
  variety: string,
  vintage: string,
  appellation: string,
  headers: string[] = FIXED_HEADERS,
): Record<string, unknown> {
  // For FIXED_HEADERS: Lot Code=index10, Variety=11, Vintage=12, Appellation=13
  // For NAMED_HEADERS: indices 3,4,5,6
  const row: Record<string, unknown> = {};
  const lcKey  = headers.find(h => h.toLowerCase().includes('lot code'))  ?? headers[10];
  const varKey = headers.find(h => h.toLowerCase().includes('variety'))   ?? headers[11];
  const vinKey = headers.find(h => h.toLowerCase().includes('vintage'))   ?? headers[12];
  const appKey = headers.find(h => h.toLowerCase().includes('appellation')) ?? headers[13];
  row[lcKey]  = lotCode;
  row[varKey] = variety;
  row[vinKey] = vintage;
  row[appKey] = appellation;
  return row;
}

function emptyRow(headers: string[] = FIXED_HEADERS): Record<string, unknown> {
  return makeRow('', '', '', '', headers);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LotCompositionNormalizerService', () => {
  let svc: LotCompositionNormalizerService;

  beforeEach(() => {
    svc = new LotCompositionNormalizerService();
  });

  // ── detectColumns ─────────────────────────────────────────────────────────

  describe('detectColumns()', () => {
    it('detects columns by label (case-insensitive match)', () => {
      const headers = ['X','Y','Lot Code','Variety','Vintage','Appellation'];
      const keys = svc.detectColumns(headers);
      expect(keys.lotCode).toBe('Lot Code');
      expect(keys.variety).toBe('Variety');
      expect(keys.vintage).toBe('Vintage');
      expect(keys.appellation).toBe('Appellation');
    });

    it('falls back to fixed position 10/11/12/13 when labels not found', () => {
      const keys = svc.detectColumns(FIXED_HEADERS);
      expect(keys.lotCode).toBe('Lot Code');    // index 10
      expect(keys.variety).toBe('Variety');     // index 11
      expect(keys.vintage).toBe('Vintage');     // index 12
      expect(keys.appellation).toBe('Appellation'); // index 13
    });
  });

  // ── normalize() — happy path ──────────────────────────────────────────────

  describe('normalize() — happy path', () => {
    it('produces one record for a single lot+pct pair', () => {
      const rows = [
        makeRow('A23VB754C', 'Cabernet Sauvignon', '2023', 'Napa Valley'),
        makeRow('',          '100',                '98.761', '100'),
      ];
      const result = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');

      expect(result.length).toBe(1);
      expect(result[0].lotCode).toBe('A23VB754C');
      expect(result[0].varietyCode).toBe('Cabernet Sauvignon');
      expect(result[0].varietyPct).toBe(100);
      expect(result[0].vintage).toBe(2023);           // numeric vintage kept as number
      expect(result[0].vintagePct).toBeCloseTo(98.761);
      expect(result[0].appellation).toBe('Napa Valley');
      expect(result[0].appellationPct).toBe(100);
      expect(result[0].pctRowIndex).toBe(1);
      expect(result[0].notes).toEqual([]);
    });

    it('stores sourceRowIndex and pctRowIndex correctly', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '2021', 'Sonoma'),
        makeRow('',       '60',     '100',  '100'),
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.sourceRowIndex).toBe(0);
      expect(rec.pctRowIndex).toBe(1);
    });

    it('handles multiple lot+pct pairs in sequence', () => {
      const rows = [
        makeRow('LOT001', 'Merlot',      '2020', 'Napa'),
        makeRow('',       '100',         '100',  '100'),
        makeRow('LOT002', 'Chardonnay',  '2021', 'Sonoma'),
        makeRow('',       '75',          '100',  '100'),
      ];
      const result = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(result.length).toBe(2);
      expect(result[0].lotCode).toBe('LOT001');
      expect(result[1].lotCode).toBe('LOT002');
      expect(result[1].varietyPct).toBe(75);
    });

    it('uses named headers when labels appear at non-standard positions', () => {
      const rows = [
        makeRow('LOT-X', 'Pinot Noir', '2022', 'Oregon', NAMED_HEADERS),
        makeRow('',       '50',         '100',  '100',    NAMED_HEADERS),
      ];
      const result = svc.normalize(rows, NAMED_HEADERS, 'ws1', 'file1');
      expect(result.length).toBe(1);
      expect(result[0].lotCode).toBe('LOT-X');
      expect(result[0].varietyCode).toBe('Pinot Noir');
      expect(result[0].varietyPct).toBe(50);
    });

    it('preserves odd lot code prefixes like [;A23VB754C', () => {
      const rows = [
        makeRow('[;A23VB754C', 'Zinfandel', '2019', 'Dry Creek'),
        makeRow('',            '100',        '100',  '100'),
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.lotCode).toBe('[;A23VB754C');
    });
  });

  // ── normalize() — missing pct row ─────────────────────────────────────────

  describe('normalize() — missing pct row', () => {
    it('produces a record with null pcts and a "missing percent row" note when no pct row follows', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '2020', 'Napa'),
        // no pct row
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.varietyPct).toBeNull();
      expect(rec.vintagePct).toBeNull();
      expect(rec.appellationPct).toBeNull();
      expect(rec.pctRowIndex).toBeNull();
      expect(rec.notes).toContain('missing percent row');
    });

    it('produces records for both lots when second lot has no pct row', () => {
      const rows = [
        makeRow('LOT001', 'Merlot',     '2020', 'Napa'),
        makeRow('',       '100',        '100',  '100'),    // pct for LOT001
        makeRow('LOT002', 'Chardonnay', '2021', 'Sonoma'), // no pct follows
      ];
      const result = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(result.length).toBe(2);
      expect(result[1].notes).toContain('missing percent row');
    });
  });

  // ── normalize() — skipping ────────────────────────────────────────────────

  describe('normalize() — row skipping', () => {
    it('skips empty rows between lot-pct pairs', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '2020', 'Napa'),
        makeRow('',       '100',    '100',  '100'),    // pct row
        emptyRow(),                                     // blank between sections
        makeRow('LOT002', 'Syrah',  '2018', 'Paso Robles'),
        makeRow('',       '80',     '100',  '100'),
      ];
      const result = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(result.length).toBe(2);
      expect(result[0].lotCode).toBe('LOT001');
      expect(result[1].lotCode).toBe('LOT002');
      expect(result[1].varietyPct).toBe(80);
    });

    it('skips the header row when Lot Code column contains "Lot Code"', () => {
      const rows = [
        makeRow('Lot Code', 'Variety', 'Vintage', 'Appellation'), // repeated header
        makeRow('LOT001',   'Merlot',  '2020',    'Napa'),
        makeRow('',         '100',     '100',     '100'),
      ];
      const result = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(result.length).toBe(1);
      expect(result[0].lotCode).toBe('LOT001');
    });

    it('skips rows whose lot code looks like auto-generated column header (Column11)', () => {
      const rows = [
        makeRow('Column11', 'Column12', 'Column13', 'Column14'),
        makeRow('LOT-A',    'Cabernet', '2022',     'Napa'),
        makeRow('',         '100',      '100',      '100'),
      ];
      const result = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(result.length).toBe(1);
      expect(result[0].lotCode).toBe('LOT-A');
    });
  });

  // ── normalize() — non-numeric pct ─────────────────────────────────────────

  describe('normalize() — non-numeric percentages', () => {
    it('records a note for non-numeric variety% and sets pct to null', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '2020', 'Napa'),
        makeRow('',       'N/A',    '100',  '100'),
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.varietyPct).toBeNull();
      expect(rec.vintagePct).toBe(100);
      expect(rec.notes.some(n => n.includes('non-numeric variety%'))).toBe(true);
    });
  });

  // ── normalize() — pct values with % suffix ────────────────────────────────

  describe('normalize() — pct string formats', () => {
    it('parses "98.761%" string as 98.761', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '2020', 'Napa'),
        makeRow('',       '98.761%', '100%', '100%'),
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.varietyPct).toBeCloseTo(98.761);
    });
  });

  // ── normalize() — vintage handling ────────────────────────────────────────

  describe('normalize() — vintage type coercion', () => {
    it('keeps numeric vintage (e.g. 2023) as number', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '2023', 'Napa'),
        makeRow('',       '100',    '100',  '100'),
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.vintage).toBe(2023);
      expect(typeof rec.vintage).toBe('number');
    });

    it('keeps string vintage (e.g. "2020/2021") as string', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '2020/2021', 'Napa'),
        makeRow('',       '100',    '100',        '100'),
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.vintage).toBe('2020/2021');
      expect(typeof rec.vintage).toBe('string');
    });

    it('sets vintage to null when empty', () => {
      const rows = [
        makeRow('LOT001', 'Merlot', '', 'Napa'),
        makeRow('',       '100',    '',  '100'),
      ];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'ws1', 'file1');
      expect(rec.vintage).toBeNull();
    });
  });

  // ── normalize() — IndexedDB fields ────────────────────────────────────────

  describe('normalize() — output record structure', () => {
    it('populates workspaceId and sourceFileId', () => {
      const rows = [makeRow('LOT-X', 'Merlot', '2022', 'Napa')];
      const [rec] = svc.normalize(rows, FIXED_HEADERS, 'my-ws', 'my-file');
      expect(rec.workspaceId).toBe('my-ws');
      expect(rec.sourceFileId).toBe('my-file');
    });

    it('assigns a unique id (UUID-like) to each record', () => {
      const rows = [
        makeRow('LOT001', 'Merlot',     '2020', 'Napa'),
        makeRow('',       '100',        '100',  '100'),
        makeRow('LOT002', 'Chardonnay', '2021', 'Sonoma'),
        makeRow('',       '100',        '100',  '100'),
      ];
      const result = svc.normalize(rows, FIXED_HEADERS, 'ws', 'f');
      expect(result[0].id).toBeTruthy();
      expect(result[1].id).toBeTruthy();
      expect(result[0].id).not.toBe(result[1].id);
    });
  });
});
