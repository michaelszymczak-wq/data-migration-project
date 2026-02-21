import { Injectable, inject } from '@angular/core';
import { ParseService } from './parse.service';
import { RawFile, Mapping, TargetSchemaField, StagedRecord, Category } from '../models';

interface CoerceResult {
  value: unknown;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class TransformService {
  private parser = inject(ParseService);

  /**
   * Transform ALL rows from a RawFile using the saved mapping.
   * Re-parses from stored content (contentText / contentBlob) so
   * the result covers the full file, not just the 20-row preview.
   * Falls back to previewRows if no raw content is available.
   */
  async transformFile(
    rawFile: RawFile,
    previewRows: Record<string, unknown>[],   // fallback
    mapping: Mapping,
    fields: TargetSchemaField[],
  ): Promise<StagedRecord[]> {
    let allRows: Record<string, unknown>[];

    if (rawFile.contentText) {
      allRows = this.parser.allRowsCsv(rawFile.contentText);
    } else if (rawFile.contentBlob) {
      const buffer = await rawFile.contentBlob.arrayBuffer();
      allRows = this.parser.allRowsXlsx(buffer);
    } else {
      // No stored content — use the preview rows as a fallback
      allRows = previewRows;
    }

    const now = new Date().toISOString();
    return allRows.map(row =>
      this.transformRow(row, rawFile.workspaceId, mapping.category, rawFile.id, mapping, fields, now)
    );
  }

  // ── Row-level transform ─────────────────────────────────────────────────────

  private transformRow(
    row: Record<string, unknown>,
    workspaceId: string,
    category: Category,
    sourceFileId: string,
    mapping: Mapping,
    fields: TargetSchemaField[],
    createdAt: string,
  ): StagedRecord {
    const data: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const field of fields) {
      const sourceColumn = mapping.mappings[field.key];

      if (!sourceColumn) {
        // Target field has no mapping
        if (field.required) {
          errors.push(`${field.label}: required — not mapped`);
        }
        continue;
      }

      const rawValue = row[sourceColumn];

      // Empty / missing source value
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        if (field.required) {
          errors.push(`${field.label}: required — source column "${sourceColumn}" is empty`);
        }
        data[field.key] = null;
        continue;
      }

      const { value, error } = this.coerce(rawValue, field.type, field.label);
      data[field.key] = value;
      if (error) errors.push(error);
    }

    return {
      id:           crypto.randomUUID(),
      workspaceId,
      category,
      sourceFileId,
      data,
      errors,
      createdAt,
    };
  }

  // ── Type coercion ───────────────────────────────────────────────────────────

  private coerce(value: unknown, type: TargetSchemaField['type'], label: string): CoerceResult {
    switch (type) {
      case 'number': {
        // Strip common currency / comma formatting before parsing
        const cleaned = String(value).replace(/[$,\s]/g, '');
        const n = Number(cleaned);
        if (isNaN(n)) {
          return { value: null, error: `${label}: cannot convert "${value}" to number` };
        }
        return { value: n };
      }

      case 'date': {
        // Accept ISO dates, US dates (MM/DD/YYYY), and Excel serial numbers
        const raw = String(value).trim();

        // Excel serial number (e.g. 44927)
        if (/^\d{4,6}$/.test(raw)) {
          const d = this.excelSerialToDate(Number(raw));
          return { value: d };
        }

        const d = new Date(raw);
        if (isNaN(d.getTime())) {
          return { value: null, error: `${label}: cannot parse "${value}" as date` };
        }
        return { value: d.toISOString().slice(0, 10) }; // YYYY-MM-DD
      }

      case 'string':
      default:
        return { value: String(value).trim() };
    }
  }

  private excelSerialToDate(serial: number): string {
    // Excel epoch: 1900-01-00; JS epoch: 1970-01-01
    const msPerDay = 86400000;
    const excelEpoch = new Date(1899, 11, 30).getTime();
    return new Date(excelEpoch + serial * msPerDay).toISOString().slice(0, 10);
  }
}
