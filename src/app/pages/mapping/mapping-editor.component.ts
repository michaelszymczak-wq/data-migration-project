import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TargetSchemaField } from '../../models';

interface MappingRow {
  field: TargetSchemaField;
  sourceColumn: string; // '' means not mapped
}

/**
 * Reusable mapping editor.
 * Controlled: parent owns the saved state, editor owns the in-progress edits.
 * Rebuilds rows when `fields` or `initValue` changes (i.e. new file selected).
 * Does NOT re-init on every parent re-render — only on input reference change.
 */
@Component({
  selector: 'app-mapping-editor',
  standalone: true,
  imports: [MatTableModule, MatSelectModule, MatIconModule, MatTooltipModule],
  template: `
    <!-- ── Source column reference list ────────────────────────────────────── -->
    @if (sourceColumns.length > 0) {
      <div class="source-cols-bar">
        <span class="sc-label">Available columns:</span>
        @for (col of sourceColumns; track col) {
          <code class="sc-tag">{{ col }}</code>
        }
      </div>
    }

    <!-- ── Validation summary ──────────────────────────────────────────────── -->
    @if (unmappedRequired > 0) {
      <div class="validation-row val-error">
        <mat-icon>error_outline</mat-icon>
        {{ unmappedRequired }} required field{{ unmappedRequired > 1 ? 's' : '' }} not mapped
      </div>
    }
    @if (duplicates.size > 0) {
      <div class="validation-row val-warn">
        <mat-icon>warning_amber</mat-icon>
        {{ duplicates.size }} source column{{ duplicates.size > 1 ? 's' : '' }} used more than once
      </div>
    }
    @if (unmappedRequired === 0 && duplicates.size === 0 && rows.length > 0) {
      <div class="validation-row val-ok">
        <mat-icon>check_circle_outline</mat-icon>
        All required fields mapped — no duplicates
      </div>
    }

    <!-- ── Mapping table ───────────────────────────────────────────────────── -->
    <table mat-table [dataSource]="rows" class="editor-table">

      <!-- Required star -->
      <ng-container matColumnDef="req">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let row">
          @if (row.field.required) {
            <span class="req-star" matTooltip="Required field">★</span>
          }
        </td>
      </ng-container>

      <!-- Target field label -->
      <ng-container matColumnDef="target">
        <th mat-header-cell *matHeaderCellDef>Target field</th>
        <td mat-cell *matCellDef="let row"
            [class.cell-error]="row.field.required && !row.sourceColumn">
          <span class="field-label">{{ row.field.label }}</span>
          <code class="field-key">{{ row.field.key }}</code>
        </td>
      </ng-container>

      <!-- Source column select -->
      <ng-container matColumnDef="source">
        <th mat-header-cell *matHeaderCellDef>Source column</th>
        <td mat-cell *matCellDef="let row">
          <mat-select
            class="source-select"
            [class.sel-error]="row.field.required && !row.sourceColumn"
            [class.sel-warn]="row.sourceColumn && duplicates.has(row.sourceColumn)"
            [value]="row.sourceColumn"
            (selectionChange)="updateRow(row.field.key, $event.value)"
            placeholder="— not mapped —">
            <mat-option value="">— not mapped —</mat-option>
            @for (col of sourceColumns; track col) {
              <mat-option [value]="col">{{ col }}</mat-option>
            }
          </mat-select>
        </td>
      </ng-container>

      <!-- Type badge -->
      <ng-container matColumnDef="type">
        <th mat-header-cell *matHeaderCellDef>Type</th>
        <td mat-cell *matCellDef="let row">
          <span class="type-badge type-{{ row.field.type }}">{{ row.field.type }}</span>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="COLS"></tr>
      <tr mat-row *matRowDef="let r; columns: COLS;"
          [class.row-error]="r.field.required && !r.sourceColumn"
          [class.row-warn]="r.sourceColumn && duplicates.has(r.sourceColumn)"></tr>
    </table>
  `,
  styles: [`
    /* ── Source column bar ───────────────────────────────────── */
    .source-cols-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      font-size: 12px;
    }

    .sc-label { color: rgba(0,0,0,0.5); font-weight: 500; margin-right: 2px; }

    .sc-tag {
      background: #e8eaf6;
      color: #3f51b5;
      padding: 1px 7px;
      border-radius: 4px;
      font-size: 11px;
    }

    /* ── Validation row ──────────────────────────────────────── */
    .validation-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 13px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .val-error { background: #ffebee; color: #c62828; }
    .val-warn  { background: #fff8e1; color: #f57f17; }
    .val-ok    { background: #e8f5e9; color: #2e7d32; }

    /* ── Table ───────────────────────────────────────────────── */
    .editor-table { width: 100%; }

    .req-star { color: #e53935; font-size: 14px; }

    .field-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
    }

    .field-key {
      display: block;
      font-size: 11px;
      color: rgba(0,0,0,0.4);
    }

    .source-select { min-width: 200px; font-size: 13px; }

    .sel-error { border-bottom: 2px solid #e53935 !important; }
    .sel-warn  { border-bottom: 2px solid #fb8c00 !important; }

    /* ── Type badges ─────────────────────────────────────────── */
    .type-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }

    .type-string { background: #e3f2fd; color: #1565c0; }
    .type-number { background: #e8f5e9; color: #2e7d32; }
    .type-date   { background: #fce4ec; color: #880e4f; }

    /* ── Row highlights ──────────────────────────────────────── */
    .row-error { background: #fff8f8; }
    .row-warn  { background: #fffde7; }
    .cell-error { color: #c62828; }
  `],
})
export class MappingEditorComponent implements OnChanges {
  @Input() fields: TargetSchemaField[] = [];
  @Input() sourceColumns: string[] = [];
  /**
   * Initial mapping values. Only used to populate rows when `fields` changes
   * (i.e. when a new file/category is selected). User edits are tracked
   * internally — parent should NOT update this reactively to avoid re-init loops.
   */
  @Input() initValue: Record<string, string> = {};

  @Output() valueChange = new EventEmitter<Record<string, string>>();

  rows: MappingRow[] = [];
  COLS = ['req', 'target', 'source', 'type'];

  // ── Derived validation (getters, recomputed on every CD cycle) ─────────────

  get unmappedRequired(): number {
    return this.rows.filter(r => r.field.required && !r.sourceColumn).length;
  }

  get duplicates(): Set<string> {
    const used = this.rows.map(r => r.sourceColumn).filter(Boolean);
    const counts = new Map<string, number>();
    for (const c of used) counts.set(c, (counts.get(c) ?? 0) + 1);
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields'] || changes['initValue']) {
      this.rows = this.fields.map(f => ({
        field: f,
        sourceColumn: this.initValue[f.key] ?? '',
      }));
    }
  }

  // ── Interactions ───────────────────────────────────────────────────────────

  updateRow(fieldKey: string, sourceColumn: string): void {
    // Immutable update so mat-table detects the change
    this.rows = this.rows.map(r =>
      r.field.key === fieldKey ? { ...r, sourceColumn } : r
    );
    this.emit();
  }

  private emit(): void {
    const m: Record<string, string> = {};
    for (const r of this.rows) {
      if (r.sourceColumn) m[r.field.key] = r.sourceColumn;
    }
    this.valueChange.emit(m);
  }
}
