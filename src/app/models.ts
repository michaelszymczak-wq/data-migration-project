// ─── Core domain types ────────────────────────────────────────────────────────

export type Category =
  | 'Vineyard+block'
  | 'Vessel'
  | 'Lot Composition'
  | 'Volume'
  | 'Historical Additive'
  | 'Cost';

export const ALL_CATEGORIES: Category[] = [
  'Vineyard+block',
  'Vessel',
  'Lot Composition',
  'Volume',
  'Historical Additive',
  'Cost',
];

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawFile {
  id: string;
  workspaceId: string;
  filename: string;
  size: number;
  mimeType: string;
  importedAt: string;
  contentText?: string | null;
  contentBlob?: Blob | null;
}

export interface Classification {
  fileId: string;
  workspaceId: string;
  category: Category;
  confidence: number;
  notes?: string;
  createdAt: string;
}

export interface ParseResult {
  fileId: string;
  workspaceId: string;
  headers: string[];
  rowCount: number;
  previewRows: Record<string, unknown>[];
  errors: string[];
  createdAt: string;
}

export interface TargetSchemaField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date';
}

export interface Mapping {
  workspaceId: string;
  category: Category;
  mappings: Record<string, string>; // targetKey → sourceColumn
  updatedAt: string;
}

export interface StagedRecord {
  id: string;
  workspaceId: string;
  category: Category;
  sourceFileId: string;
  data: Record<string, unknown>; // targetKey → coerced value
  errors: string[];
  createdAt: string;
}

export interface NormalizedLotComposition {
  id: string;
  workspaceId: string;
  sourceFileId: string;
  sourceRowIndex: number;    // row index of the lot row in the source file
  lotCode: string;
  varietyCode: string | null;
  varietyPct: number | null;
  vintage: string | number | null;
  vintagePct: number | null;
  appellation: string | null;
  appellationPct: number | null;
  pctRowIndex: number | null; // row index where percentages were found
  notes: string[];            // warnings e.g. "missing pct row", "non-numeric pct"
  createdAt: string;
}
