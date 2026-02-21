import { Component, inject, signal, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkspaceService } from '../../services/workspace.service';
import { LocalDbService } from '../../services/local-db.service';
import { ClassifierService, CATEGORY_COLOR } from '../../services/classifier.service';
import { NoWorkspaceComponent } from '../../shared/no-workspace.component';
import { RawFile, ParseResult, Classification, Category, ALL_CATEGORIES } from '../../models';

interface ReviewEntry {
  file: RawFile;
  parse?: ParseResult;
  classification?: Classification;
}

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [
    DecimalPipe, RouterLink,
    MatTableModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
    NoWorkspaceComponent,
  ],
  template: `
    @if (!ws.activeWorkspace()) {
      <app-no-workspace />
    } @else {
      <div class="page-container">

        <!-- Header -->
        <div class="page-header">
          <mat-icon>fact_check</mat-icon>
          <h2>Review &amp; Categorize</h2>
          <span class="spacer"></span>
          <button mat-stroked-button (click)="load()" [disabled]="isLoading()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>

        <!-- Classifying banner -->
        @if (classifyingCount() > 0) {
          <div class="classifying-banner">
            <mat-spinner diameter="16" />
            Auto-classifying {{ classifyingCount() }} file(s)…
          </div>
        }

        <!-- No files empty state -->
        @if (!isLoading() && entries().length === 0) {
          <div class="empty-state">
            <mat-icon>inbox</mat-icon>
            <h3>No files imported yet</h3>
            <p>Import files first, then return here to review their categories.</p>
            <a mat-raised-button color="primary" routerLink="/import">Go to Import</a>
          </div>
        }

        @if (!isLoading() && entries().length > 0) {

          <!-- Summary + filter chips -->
          <div class="filter-bar">
            <button
              class="filter-btn"
              [class.filter-active]="!activeCategory()"
              (click)="activeCategory.set(null)">
              All ({{ entries().length }})
            </button>

            @for (cat of ALL_CATEGORIES; track cat) {
              @if (categoryCounts().get(cat)) {
                <button
                  class="filter-btn"
                  [class.filter-active]="activeCategory() === cat"
                  [style.--cat-color]="CATEGORY_COLOR[cat]"
                  (click)="toggleFilter(cat)">
                  <span class="dot" [style.background]="CATEGORY_COLOR[cat]"></span>
                  {{ cat }} ({{ categoryCounts().get(cat) }})
                </button>
              }
            }
          </div>

          <!-- Table -->
          <div class="table-wrap">
            <table mat-table [dataSource]="filteredEntries()" class="review-table">

              <!-- Icon col -->
              <ng-container matColumnDef="icon">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let e">
                  <mat-icon class="file-icon">
                    {{ isCsv(e.file) ? 'description' : 'table_chart' }}
                  </mat-icon>
                </td>
              </ng-container>

              <!-- Filename col -->
              <ng-container matColumnDef="filename">
                <th mat-header-cell *matHeaderCellDef>File</th>
                <td mat-cell *matCellDef="let e">
                  <span class="filename">{{ e.file.filename }}</span>
                  <span class="filemeta">{{ e.file.size | number }} bytes</span>
                </td>
              </ng-container>

              <!-- Category col -->
              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef>Category</th>
                <td mat-cell *matCellDef="let e">
                  @if (e.classification) {
                    <span
                      class="cat-chip"
                      [style.background]="catColor(e)"
                      [matTooltip]="catNotes(e)">
                      {{ catLabel(e) }}
                    </span>
                  } @else {
                    <span class="cat-chip cat-none">pending…</span>
                  }
                </td>
              </ng-container>

              <!-- Confidence col -->
              <ng-container matColumnDef="confidence">
                <th mat-header-cell *matHeaderCellDef>Confidence</th>
                <td mat-cell *matCellDef="let e">
                  @if (e.classification) {
                    <div class="conf-wrap"
                         [matTooltip]="catNotes(e)">
                      <div class="conf-track">
                        <div
                          class="conf-fill"
                          [class]="confClass(e.classification.confidence)"
                          [style.width.%]="e.classification.confidence * 100">
                        </div>
                      </div>
                      <span class="conf-val">
                        {{ e.classification.confidence | number:'1.0-2' }}
                      </span>
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Rows / Cols col -->
              <ng-container matColumnDef="stats">
                <th mat-header-cell *matHeaderCellDef>Rows / Cols</th>
                <td mat-cell *matCellDef="let e" class="stats-cell">
                  @if (e.parse) {
                    {{ e.parse.rowCount | number }}&nbsp;/&nbsp;{{ e.parse.headers.length }}
                  } @else { — }
                </td>
              </ng-container>

              <!-- Source (auto / manual) col -->
              <ng-container matColumnDef="source">
                <th mat-header-cell *matHeaderCellDef>Source</th>
                <td mat-cell *matCellDef="let e">
                  @if (e.classification) {
                    @if (isManual(e)) {
                      <span class="source-badge source-manual">manual</span>
                    } @else {
                      <span class="source-badge source-auto">auto</span>
                    }
                  }
                </td>
              </ng-container>

              <!-- Override dropdown col -->
              <ng-container matColumnDef="override">
                <th mat-header-cell *matHeaderCellDef>Override</th>
                <td mat-cell *matCellDef="let e">
                  <mat-select
                    class="cat-select"
                    [value]="e.classification?.category ?? null"
                    (selectionChange)="overrideCategory(e, $event.value)"
                    placeholder="—">
                    @for (cat of ALL_CATEGORIES; track cat) {
                      <mat-option [value]="cat">{{ cat }}</mat-option>
                    }
                  </mat-select>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="COLUMNS"></tr>
              <tr mat-row *matRowDef="let row; columns: COLUMNS;"
                  [class.manual-row]="isManual(row)"></tr>
            </table>
          </div>

        }

        @if (isLoading()) {
          <div class="empty-state" style="margin-top:32px">
            <mat-spinner diameter="36" />
          </div>
        }

      </div>
    }
  `,
  styles: [`
    /* ── Classifying banner ──────────────────────────────────── */
    .classifying-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: #e8eaf6;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #3f51b5;
    }

    /* ── Filter bar ──────────────────────────────────────────── */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .filter-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 20px;
      border: 1.5px solid rgba(0,0,0,0.18);
      background: white;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.15s, background 0.15s;

      &:hover { border-color: rgba(0,0,0,0.4); }
      &.filter-active {
        border-color: var(--cat-color, #3f51b5);
        background: color-mix(in srgb, var(--cat-color, #3f51b5) 10%, white);
        font-weight: 500;
      }
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── Table wrapper ───────────────────────────────────────── */
    .table-wrap {
      overflow-x: auto;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 6px;
    }

    .review-table { width: 100%; }

    /* ── Cell styles ─────────────────────────────────────────── */
    .file-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #3f51b5;
      opacity: 0.7;
    }

    .filename {
      display: block;
      font-weight: 500;
      font-size: 13px;
    }

    .filemeta {
      display: block;
      font-size: 11px;
      color: rgba(0,0,0,0.4);
    }

    .cat-chip {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      color: white;
    }

    .cat-none {
      background: rgba(0,0,0,0.15);
      color: rgba(0,0,0,0.5);
    }

    /* ── Confidence bar ──────────────────────────────────────── */
    .conf-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .conf-track {
      width: 80px;
      height: 6px;
      background: rgba(0,0,0,0.1);
      border-radius: 3px;
      overflow: hidden;
    }

    .conf-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s;
    }

    .conf-high { background: #43a047; }
    .conf-med  { background: #fb8c00; }
    .conf-low  { background: #e53935; }

    .conf-val {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
      min-width: 28px;
    }

    /* ── Stats cell ──────────────────────────────────────────── */
    .stats-cell { font-size: 13px; }

    /* ── Source badge ────────────────────────────────────────── */
    .source-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }

    .source-auto   { background: #e3f2fd; color: #1565c0; }
    .source-manual { background: #f3e5f5; color: #7b1fa2; }

    /* ── Override select ─────────────────────────────────────── */
    .cat-select {
      font-size: 13px;
      min-width: 160px;
    }

    /* ── Manually-overridden row tint ────────────────────────── */
    .manual-row { background: #fdf9ff; }
  `],
})
export class ReviewComponent {
  ws         = inject(WorkspaceService);
  db         = inject(LocalDbService);
  classifier = inject(ClassifierService);

  entries        = signal<ReviewEntry[]>([]);
  isLoading      = signal(false);
  classifyingCount = signal(0);
  activeCategory = signal<Category | null>(null);

  ALL_CATEGORIES = ALL_CATEGORIES;
  CATEGORY_COLOR = CATEGORY_COLOR;
  COLUMNS = ['icon', 'filename', 'category', 'confidence', 'stats', 'source', 'override'];

  // ── Derived state ──────────────────────────────────────────────────────────

  categoryCounts = computed(() => {
    const m = new Map<Category, number>();
    for (const e of this.entries()) {
      const cat = e.classification?.category;
      if (cat) m.set(cat, (m.get(cat) ?? 0) + 1);
    }
    return m;
  });

  filteredEntries = computed(() => {
    const cat = this.activeCategory();
    if (!cat) return this.entries();
    return this.entries().filter(e => e.classification?.category === cat);
  });

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (wsId) this.load();
      else this.entries.set([]);
    });
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  async load(): Promise<void> {
    const wsId = this.ws.activeId();
    if (!wsId) return;

    this.isLoading.set(true);
    const [files, results, classifications] = await Promise.all([
      this.db.listRawFilesByWorkspace(wsId),
      this.db.listParseResultsByWorkspace(wsId),
      this.db.listClassificationsByWorkspace(wsId),
    ]);

    const parseMap = new Map(results.map(r => [r.fileId, r]));
    const classMap = new Map(classifications.map(c => [c.fileId, c]));
    const sorted   = [...files].sort((a, b) => a.importedAt.localeCompare(b.importedAt));

    this.entries.set(sorted.map(f => ({
      file:           f,
      parse:          parseMap.get(f.id),
      classification: classMap.get(f.id),
    })));
    this.isLoading.set(false);

    // Classify any files that don't yet have a saved classification
    await this.autoClassifyMissing(wsId, classMap);
  }

  private async autoClassifyMissing(
    wsId: string,
    existingClassMap: Map<string, Classification>,
  ): Promise<void> {
    const unclassified = this.entries().filter(
      e => !existingClassMap.has(e.file.id) && e.parse,
    );
    if (unclassified.length === 0) return;

    this.classifyingCount.set(unclassified.length);

    for (const entry of unclassified) {
      const result = this.classifier.classify(entry.file.filename, entry.parse!.headers);
      const cl: Classification = {
        fileId:      entry.file.id,
        workspaceId: wsId,
        category:    result.category,
        confidence:  result.confidence,
        notes:       result.notes,
        createdAt:   new Date().toISOString(),
      };
      await this.db.putClassification(cl);
      this.entries.update(list =>
        list.map(e => e.file.id === entry.file.id ? { ...e, classification: cl } : e)
      );
      this.classifyingCount.update(n => n - 1);
    }
  }

  // ── Override ───────────────────────────────────────────────────────────────

  async overrideCategory(entry: ReviewEntry, newCategory: Category): Promise<void> {
    const wsId = this.ws.activeId();
    if (!wsId || entry.classification?.category === newCategory) return;

    const cl: Classification = {
      fileId:      entry.file.id,
      workspaceId: wsId,
      category:    newCategory,
      confidence:  1.0,
      notes:       'manual override',
      createdAt:   entry.classification?.createdAt ?? new Date().toISOString(),
    };
    await this.db.putClassification(cl);
    this.entries.update(list =>
      list.map(e => e.file.id === entry.file.id ? { ...e, classification: cl } : e)
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  toggleFilter(cat: Category): void {
    this.activeCategory.update(curr => curr === cat ? null : cat);
  }

  isManual(entry: ReviewEntry): boolean {
    return entry.classification?.notes === 'manual override';
  }

  confClass(confidence: number): string {
    return confidence >= 0.65 ? 'conf-high' : confidence >= 0.35 ? 'conf-med' : 'conf-low';
  }

  isCsv(file: RawFile): boolean {
    return file.filename.toLowerCase().endsWith('.csv');
  }

  // Used in template to avoid mat-table generic inference issues with Record indexing
  catColor(entry: ReviewEntry): string {
    return entry.classification ? CATEGORY_COLOR[entry.classification.category] : '';
  }

  catLabel(entry: ReviewEntry): string {
    return entry.classification?.category ?? '';
  }

  catNotes(entry: ReviewEntry): string {
    return entry.classification?.notes ?? '';
  }
}
