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
  validationIssues?: ValidationIssue[]; // populated after validation run
  createdAt: string;
}

// ─── Validation ────────────────────────────────────────────────────────────────

export type ValidationRuleType = 'required' | 'range' | 'pattern' | 'no_future_date' | 'unique';

export interface ValidationRuleParams {
  min?: number;          // for 'range'
  max?: number;          // for 'range'
  pattern?: string;      // for 'pattern' (regex string)
  patternHint?: string;  // human-readable description of the pattern
}

export interface ValidationRule {
  id: string;
  workspaceId: string;
  category: Category;
  name: string;
  field: string;                   // target schema field key
  type: ValidationRuleType;
  params: ValidationRuleParams;
  severity: 'error' | 'warning';
  builtIn: boolean;                // built-in rules cannot be deleted
  enabled: boolean;
  createdAt: string;
}

export interface ValidationIssue {
  ruleId: string;
  ruleName: string;
  field: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

// ─── Template Mapping ─────────────────────────────────────────────────────────

export type MappingSourceKind = 'constant' | 'field' | 'expression';

export interface MappingRule {
  targetColumn: string;
  sourceKind: MappingSourceKind | '';
  sourceValue: string;  // field path like 'lotComposition.lotCode', literal, or expression
  required?: boolean;
}

export interface TemplateSpec {
  id: string;
  name: string;
  importedAt: string;
  sheets: Array<{ sheetName: string; headers: string[] }>;
  source: 'bundled' | 'uploaded';
  rawBlob?: Blob;  // stored in IndexedDB; needed to generate filled XLSX
}

export interface TemplateMapping {
  id: string;  // `${workspaceId}:${templateId}:${sheetName}`
  workspaceId: string;
  templateId: string;
  sheetName: string;
  rules: MappingRule[];
  updatedAt: string;
}

export interface GeneratedSheetPreview {
  id: string;  // `${workspaceId}:${templateId}:${sheetName}`
  workspaceId: string;
  templateId: string;
  sheetName: string;
  rowCount: number;
  previewRows: Record<string, unknown>[];
  errors: string[];
  generatedAt: string;
}

// ─── Normalized Lot Composition ───────────────────────────────────────────────

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
