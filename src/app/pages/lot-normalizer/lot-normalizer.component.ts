import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { WorkspaceService } from '../../services/workspace.service';
import { LocalDbService } from '../../services/local-db.service';
import { ParseService } from '../../services/parse.service';
import { LotCompositionNormalizerService } from '../../services/lot-composition-normalizer.service';
import { NoWorkspaceComponent } from '../../shared/no-workspace.component';

import { RawFile, Classification, ParseResult, NormalizedLotComposition } from '../../models';

interface LotFile {
  file: RawFile;
  parseResult: ParseResult | undefined;
}

@Component({
  selector: 'app-lot-normalizer',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatSlideToggleModule,
    NoWorkspaceComponent,
  ],
  styles: [`
    .controls-row {
      display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .controls-row mat-form-field { min-width: 260px; }

    .stats-bar {
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      padding: 10px 0; font-size: 13px; color: #555;
    }
    .stat-chip {
      padding: 4px 12px; border-radius: 16px; font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 6px;
    }
    .chip-total   { background: #e8eaf6; color: #1a237e; }
    .chip-notes   { background: #fff3e0; color: #e65100; }
    .chip-clean   { background: #e8f5e9; color: #1b5e20; }

    .filter-row {
      display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .filter-row mat-form-field { min-width: 220px; }

    .results-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #e0e0e0; }

    table.results-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    table.results-table th {
      background: #1a237e; color: #fff;
      padding: 9px 12px; text-align: left;
      white-space: nowrap; font-weight: 500;
      position: sticky; top: 0;
    }
    table.results-table td {
      padding: 7px 12px; border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }
    table.results-table tr:last-child td { border-bottom: none; }
    table.results-table tr:nth-child(even) td { background: #fafafa; }
    table.results-table tr.has-notes td { background: #fffde7 !important; }

    .cell-pair { display: flex; flex-direction: column; }
    .cell-main { font-weight: 500; }
    .cell-pct  { font-size: 11px; color: #1565c0; margin-top: 2px; }
    .cell-pct.missing { color: #bbb; font-style: italic; }

    .lot-code   { font-family: monospace; font-size: 12px; color: #333; }
    .row-idx    { font-size: 11px; color: #aaa; }

    .notes-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 12px;
      background: #fff3e0; color: #bf360c;
      font-size: 11px; font-weight: 500; cursor: default;
    }
    .notes-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .empty-state {
      text-align: center; padding: 48px 24px; color: #888;
    }
    .empty-state mat-icon {
      font-size: 56px; width: 56px; height: 56px;
      color: #ccc; display: block; margin: 0 auto 12px;
    }

    .no-files-msg {
      padding: 16px; background: #fff8e1; border-radius: 8px;
      font-size: 14px; color: #795548;
      display: flex; align-items: center; gap: 8px;
    }

    .action-bar {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 12px 0;
    }
    .saved-msg { font-size: 13px; color: #388e3c; }
  `],
  template: `
    @if (!ws.activeWorkspace()) {
      <app-no-workspace />
    } @else {
      <div class="page-container">
        <div class="page-header">
          <mat-icon>join_inner</mat-icon>
          <h2>Lot Composition Normalizer</h2>
        </div>

        @if (lotFiles().length === 0 && !loading()) {
          <div class="no-files-msg">
            <mat-icon>info</mat-icon>
            No files are categorised as <strong>Lot Composition</strong> yet.
            Go to <strong>Review</strong> to classify files, then come back here.
          </div>
        } @else {

          <!-- ── File selector + Normalize button ────────── -->
          <div class="controls-row">
            <mat-form-field appearance="outline">
              <mat-label>Select Lot Composition file</mat-label>
              <mat-select [ngModel]="selectedFileId()"
                          (ngModelChange)="selectFile($event)">
                @for (lf of lotFiles(); track lf.file.id) {
                  <mat-option [value]="lf.file.id">
                    {{ lf.file.filename }}
                    @if (lf.parseResult) {
                      <span style="color:#888; font-size:11px; margin-left:6px">
                        ({{ lf.parseResult.rowCount | number }} rows)
                      </span>
                    }
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="action-bar">
              <button mat-flat-button color="primary"
                      [disabled]="!selectedFileId() || normalizing()"
                      (click)="runNormalize()">
                @if (normalizing()) {
                  <mat-spinner diameter="18" style="display:inline-block;margin-right:6px" />
                } @else {
                  <mat-icon>auto_fix_high</mat-icon>
                }
                Normalize Lot Composition
              </button>

              @if (savedAt()) {
                <span class="saved-msg">
                  <mat-icon style="font-size:16px;vertical-align:middle">check_circle</mat-icon>
                  Saved {{ savedAt() }}
                </span>
              }
            </div>
          </div>

          <!-- ── Results ─────────────────────────────────── -->
          @if (records().length > 0) {

            <!-- Stats -->
            <div class="stats-bar">
              <div class="stat-chip chip-total">
                <mat-icon style="font-size:16px;width:16px;height:16px">table_rows</mat-icon>
                {{ records().length | number }} records
              </div>
              @if (notesCount() > 0) {
                <div class="stat-chip chip-notes">
                  <mat-icon style="font-size:16px;width:16px;height:16px">warning</mat-icon>
                  {{ notesCount() | number }} with warnings
                </div>
              } @else {
                <div class="stat-chip chip-clean">
                  <mat-icon style="font-size:16px;width:16px;height:16px">check_circle</mat-icon>
                  No warnings
                </div>
              }
            </div>

            <!-- Filters -->
            <div class="filter-row">
              <mat-form-field appearance="outline">
                <mat-label>Search lot code</mat-label>
                <input matInput [ngModel]="searchTerm()"
                       (ngModelChange)="searchTerm.set($event)"
                       placeholder="e.g. A23VB754C">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>

              <mat-slide-toggle color="warn"
                                [ngModel]="showNotesOnly()"
                                (ngModelChange)="showNotesOnly.set($event)">
                Show warnings only
              </mat-slide-toggle>
            </div>

            @if (filtered().length === 0) {
              <div class="empty-state">
                <mat-icon>filter_list_off</mat-icon>
                <p>No records match the current filter.</p>
              </div>
            } @else {
              <div class="results-wrap">
                <table class="results-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Lot Code</th>
                      <th>Variety / %</th>
                      <th>Vintage / %</th>
                      <th>Appellation / %</th>
                      <th>Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (rec of filtered(); track rec.id; let i = $index) {
                      <tr [class.has-notes]="rec.notes.length > 0">
                        <td class="row-idx">{{ rec.sourceRowIndex + 1 }}</td>
                        <td class="lot-code">{{ rec.lotCode }}</td>

                        <!-- Variety -->
                        <td>
                          <div class="cell-pair">
                            <span class="cell-main">{{ rec.varietyCode ?? '—' }}</span>
                            @if (rec.varietyPct !== null) {
                              <span class="cell-pct">{{ rec.varietyPct }}%</span>
                            } @else {
                              <span class="cell-pct missing">no %</span>
                            }
                          </div>
                        </td>

                        <!-- Vintage -->
                        <td>
                          <div class="cell-pair">
                            <span class="cell-main">{{ rec.vintage ?? '—' }}</span>
                            @if (rec.vintagePct !== null) {
                              <span class="cell-pct">{{ rec.vintagePct }}%</span>
                            } @else {
                              <span class="cell-pct missing">no %</span>
                            }
                          </div>
                        </td>

                        <!-- Appellation -->
                        <td>
                          <div class="cell-pair">
                            <span class="cell-main">{{ rec.appellation ?? '—' }}</span>
                            @if (rec.appellationPct !== null) {
                              <span class="cell-pct">{{ rec.appellationPct }}%</span>
                            } @else {
                              <span class="cell-pct missing">no %</span>
                            }
                          </div>
                        </td>

                        <!-- Notes / warnings -->
                        <td>
                          @if (rec.notes.length > 0) {
                            <span class="notes-badge"
                                  [matTooltip]="rec.notes.join('\n')"
                                  matTooltipClass="multiline-tooltip">
                              <mat-icon>warning</mat-icon>
                              {{ rec.notes.length }}
                            </span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (filtered().length < records().length) {
                  <div style="text-align:center;padding:8px;font-size:12px;color:#888;border-top:1px solid #f0f0f0;">
                    Showing {{ filtered().length | number }} of {{ records().length | number }} records
                  </div>
                }
              </div>
            }

          } @else if (selectedFileId() && !normalizing()) {
            <div class="empty-state">
              <mat-icon>auto_fix_high</mat-icon>
              <p>Click <strong>Normalize Lot Composition</strong> to parse and normalize this file.</p>
            </div>
          }

        }
      </div>
    }
  `,
})
export class LotNormalizerComponent {
  readonly ws         = inject(WorkspaceService);
  private db          = inject(LocalDbService);
  private parser      = inject(ParseService);
  private normalizer  = inject(LotCompositionNormalizerService);

  loading        = signal(false);
  normalizing    = signal(false);

  private allFiles        = signal<RawFile[]>([]);
  private classifications = signal<Classification[]>([]);
  private parseResults    = signal<ParseResult[]>([]);

  selectedFileId = signal<string | null>(null);
  records        = signal<NormalizedLotComposition[]>([]);
  searchTerm     = signal('');
  showNotesOnly  = signal(false);
  savedAt        = signal<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  /** Only files classified as Lot Composition */
  readonly lotFiles = computed<LotFile[]>(() => {
    const cls = this.classifications().filter(c => c.category === 'Lot Composition');
    const clsFileIds = new Set(cls.map(c => c.fileId));
    const prs = this.parseResults();
    return this.allFiles()
      .filter(f => clsFileIds.has(f.id))
      .map(f => ({ file: f, parseResult: prs.find(p => p.fileId === f.id) }));
  });

  readonly notesCount = computed(() => this.records().filter(r => r.notes.length > 0).length);

  readonly filtered = computed(() => {
    let recs = this.records();
    if (this.showNotesOnly()) recs = recs.filter(r => r.notes.length > 0);
    const term = this.searchTerm().trim().toLowerCase();
    if (term) recs = recs.filter(r => r.lotCode.toLowerCase().includes(term));
    return recs;
  });

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (wsId) {
        this.load(wsId);
      } else {
        this.allFiles.set([]);
        this.classifications.set([]);
        this.parseResults.set([]);
        this.selectedFileId.set(null);
        this.records.set([]);
      }
    });
  }

  private async load(wsId: string): Promise<void> {
    this.loading.set(true);
    const [files, cls, prs] = await Promise.all([
      this.db.listRawFilesByWorkspace(wsId),
      this.db.listClassificationsByWorkspace(wsId),
      this.db.listParseResultsByWorkspace(wsId),
    ]);
    this.allFiles.set(files);
    this.classifications.set(cls);
    this.parseResults.set(prs);
    this.loading.set(false);
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  async selectFile(fileId: string): Promise<void> {
    this.selectedFileId.set(fileId);
    this.savedAt.set(null);
    // Load any existing normalized records for this file
    const existing = await this.db.listNormalizedByFile(fileId);
    this.records.set(existing);
  }

  async runNormalize(): Promise<void> {
    const fileId = this.selectedFileId();
    const wsId   = this.ws.activeId();
    if (!fileId || !wsId) return;

    this.normalizing.set(true);
    this.savedAt.set(null);

    try {
      // 1. Load raw file (for full content) and parse result (for headers)
      const [rawFile, parseResult] = await Promise.all([
        this.db.getRawFile(fileId),
        this.db.getParseResult(fileId),
      ]);

      if (!rawFile || !parseResult) {
        console.warn('LotNormalizer: missing rawFile or parseResult for', fileId);
        this.normalizing.set(false);
        return;
      }

      // 2. Re-parse ALL rows (not just the 20-row preview)
      let allRows: Record<string, unknown>[];
      if (rawFile.contentText) {
        allRows = this.parser.allRowsCsv(rawFile.contentText);
      } else if (rawFile.contentBlob) {
        const buf = await rawFile.contentBlob.arrayBuffer();
        allRows = this.parser.allRowsXlsx(buf);
      } else {
        allRows = parseResult.previewRows;
      }

      // 3. Normalize
      const normalized = this.normalizer.normalize(allRows, parseResult.headers, wsId, fileId);

      // 4. Persist (replace existing for this file)
      await this.db.deleteNormalizedByFile(fileId);
      await this.db.putNormalizedRecords(normalized);

      // 5. Update UI
      this.records.set(normalized);
      const now = new Date();
      this.savedAt.set(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
    } finally {
      this.normalizing.set(false);
    }
  }
}
