import { Component, inject, signal, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { WorkspaceService } from '../../services/workspace.service';
import { LocalDbService } from '../../services/local-db.service';
import { TargetSchemaService } from '../../services/target-schema.service';
import { TransformService } from '../../services/transform.service';
import { CATEGORY_COLOR } from '../../services/classifier.service';
import { ValidationRulesService, builtInRulesFor } from '../../services/validation-rules.service';
import { ToastService } from '../../services/toast.service';
import { WorkflowStatusService } from '../../services/workflow-status.service';
import { NoWorkspaceComponent } from '../../shared/no-workspace.component';
import { MappingEditorComponent } from './mapping-editor.component';
import {
  RawFile, ParseResult, Classification, Category,
  TargetSchemaField, Mapping, StagedRecord,
} from '../../models';

interface FileRecord {
  file: RawFile;
  classification: Classification;
  parse: ParseResult;
}

interface StagingResult {
  totalRecords: number;
  errorCount: number;
  validationIssueCount: number;
  preview: StagedRecord[];
}

const PREVIEW_LIMIT = 20;

@Component({
  selector: 'app-mapping',
  standalone: true,
  imports: [
    DecimalPipe, RouterLink,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatTooltipModule, MatDividerModule,
    NoWorkspaceComponent, MappingEditorComponent,
  ],
  template: `
    @if (!ws.activeWorkspace()) {
      <app-no-workspace />
    } @else {
      <div class="page-container">

        <!-- Header -->
        <div class="page-header">
          <mat-icon>schema</mat-icon>
          <h2>Field Mapping</h2>
          <span class="spacer"></span>
          <button mat-stroked-button (click)="load()" [disabled]="isLoading()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>

        @if (isLoading()) {
          <div class="empty-state" style="margin-top:32px">
            <mat-spinner diameter="36" />
          </div>
        }

        @if (!isLoading() && fileRecords().length === 0) {
          <div class="empty-state">
            <mat-icon>schema</mat-icon>
            <h3>No classified files yet</h3>
            <p>Import and categorise files first, then map their columns here.</p>
            <a mat-raised-button color="primary" routerLink="/review">Go to Review</a>
          </div>
        }

        @if (!isLoading() && fileRecords().length > 0) {
          <div class="mapping-layout">

            <!-- ── File panel ─────────────────────────────────────────── -->
            <div class="file-panel">
              <div class="panel-header">
                Classified Files <span class="count">({{ fileRecords().length }})</span>
              </div>

              @for (rec of fileRecords(); track rec.file.id) {
                <div class="file-item"
                     [class.selected]="isSelected(rec)"
                     (click)="selectFile(rec)">
                  <div class="fi-top">
                    <mat-icon class="fi-icon">
                      {{ isCsv(rec.file) ? 'description' : 'table_chart' }}
                    </mat-icon>
                    <span class="fi-name" [title]="rec.file.filename">
                      {{ rec.file.filename }}
                    </span>
                    @if (hasSavedMapping(rec)) {
                      <mat-icon class="fi-saved" matTooltip="Mapping saved">
                        check_circle
                      </mat-icon>
                    }
                  </div>
                  <span class="cat-badge"
                        [style.background]="catColor(rec.classification.category)">
                    {{ rec.classification.category }}
                  </span>
                </div>
              }
            </div>

            <!-- ── Editor panel ────────────────────────────────────────── -->
            <div class="editor-panel">

              @if (!selectedFile()) {
                <div class="empty-state">
                  <mat-icon>arrow_back</mat-icon>
                  <p>Select a file to map its columns.</p>
                </div>

              } @else {

                <!-- Editor header -->
                <div class="editor-header">
                  <div class="eh-top">
                    <mat-icon>
                      {{ isCsv(selectedFile()!.file) ? 'description' : 'table_chart' }}
                    </mat-icon>
                    <strong>{{ selectedFile()!.file.filename }}</strong>
                    <span class="cat-badge"
                          [style.background]="catColor(selectedFile()!.classification.category)">
                      {{ selectedFile()!.classification.category }}
                    </span>
                  </div>
                  <p class="scope-note">
                    <mat-icon inline>info_outline</mat-icon>
                    Mapping applies to all
                    <strong>{{ selectedFile()!.classification.category }}</strong>
                    files in this workspace.
                  </p>
                </div>

                <!-- Scrollable body: editor + staging -->
                <div class="editor-body">

                  <!-- Mapping editor -->
                  <app-mapping-editor
                    [fields]="targetFields()"
                    [sourceColumns]="sourceColumns()"
                    [initValue]="editorInitValue()"
                    (valueChange)="onMappingChange($event)" />

                  <!-- ── Staging preview section ──────────────────────── -->
                  <mat-divider />

                  <div class="staging-section">
                    <div class="staging-header">
                      <h4>Staging Preview</h4>
                      <span class="spacer"></span>
                      <button mat-raised-button
                              color="accent"
                              [disabled]="!hasSavedMappingForFile() || isGenerating()"
                              (click)="generateStaging()"
                              [matTooltip]="hasSavedMappingForFile() ? '' : 'Save the mapping first'">
                        @if (isGenerating()) {
                          <mat-spinner diameter="16" style="display:inline-block;margin-right:6px" />
                          Generating…
                        } @else {
                          <mat-icon>play_arrow</mat-icon>
                          Generate Staging Preview
                        }
                      </button>
                    </div>

                    @if (!hasSavedMappingForFile()) {
                      <p class="staging-hint">
                        Save the mapping above, then click Generate to preview transformed records.
                      </p>
                    }

                    @if (stagingResult()) {
                      <!-- Stats bar -->
                      <div class="staging-stats">
                        <span class="stat-chip stat-total">
                          <mat-icon inline>storage</mat-icon>
                          {{ stagingResult()!.totalRecords | number }} records staged
                        </span>
                        @if (stagingResult()!.errorCount > 0) {
                          <span class="stat-chip stat-err">
                            <mat-icon inline>error_outline</mat-icon>
                            {{ stagingResult()!.errorCount | number }} transform errors
                          </span>
                        }
                        @if (stagingResult()!.validationIssueCount > 0) {
                          <span class="stat-chip stat-warn">
                            <mat-icon inline>warning_amber</mat-icon>
                            {{ stagingResult()!.validationIssueCount | number }} validation issues
                          </span>
                        }
                        @if (stagingResult()!.errorCount === 0 && stagingResult()!.validationIssueCount === 0) {
                          <span class="stat-chip stat-ok">
                            <mat-icon inline>check_circle_outline</mat-icon>
                            All clean
                          </span>
                        }
                        <span class="stat-chip stat-info">
                          Showing first {{ stagingResult()!.preview.length }}
                        </span>
                      </div>

                      <!-- Preview table -->
                      <div class="staged-scroll">
                        <table class="staged-table">
                          <thead>
                            <tr>
                              <th class="status-col"></th>
                              @for (f of targetFields(); track f.key) {
                                <th>{{ f.label }}</th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (rec of stagingResult()!.preview; track rec.id) {
                              <tr [class.staged-row-err]="rec.errors.length > 0">
                                <td class="status-col">
                                  @if (rec.errors.length > 0) {
                                    <mat-icon class="row-err-icon"
                                              [matTooltip]="rec.errors.join('\n')">
                                      error_outline
                                    </mat-icon>
                                  } @else {
                                    <mat-icon class="row-ok-icon">check_circle_outline</mat-icon>
                                  }
                                </td>
                                @for (f of targetFields(); track f.key) {
                                  <td [class.cell-null]="rec.data[f.key] === null">
                                    {{ rec.data[f.key] ?? '—' }}
                                  </td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  </div>

                </div><!-- /editor-body -->

                <!-- Actions bar (sticky at bottom) -->
                <div class="actions-bar">
                  @if (savedAt()) {
                    <span class="saved-label">
                      <mat-icon>check_circle</mat-icon>
                      Saved {{ savedAt() }}
                    </span>
                  }
                  <span class="spacer"></span>
                  <button mat-button (click)="clearMapping()">Clear All</button>
                  <button mat-raised-button color="primary"
                          [disabled]="isSaving()"
                          (click)="saveMapping()">
                    @if (isSaving()) {
                      <mat-spinner diameter="16" style="display:inline-block" />
                    } @else {
                      <mat-icon>save</mat-icon>
                    }
                    Save Mapping
                  </button>
                </div>

              }
            </div><!-- /editor-panel -->

          </div>
        }

      </div>
    }
  `,
  styles: [`
    /* ── Layout ──────────────────────────────────────────────── */
    .mapping-layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: 16px;
      height: calc(100vh - 190px);
      min-height: 400px;
    }

    /* ── File panel ──────────────────────────────────────────── */
    .file-panel {
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 6px;
      background: #fafafa;
      overflow-y: auto;
      align-self: stretch;
    }

    .panel-header {
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(0,0,0,0.5);
      border-bottom: 1px solid rgba(0,0,0,0.08);
      position: sticky;
      top: 0;
      background: #fafafa;
      z-index: 1;
    }

    .count { font-weight: 400; }

    .file-item {
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(0,0,0,0.05);
      transition: background 0.15s;
      &:hover    { background: rgba(0,0,0,0.04); }
      &.selected { background: rgba(63,81,181,0.08); }
    }

    .fi-top {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .fi-icon {
      font-size: 16px; width: 16px; height: 16px;
      color: #3f51b5; flex-shrink: 0;
    }

    .fi-name {
      font-size: 13px; font-weight: 500; flex: 1;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .fi-saved {
      font-size: 14px; width: 14px; height: 14px;
      color: #43a047; flex-shrink: 0;
    }

    .cat-badge {
      display: inline-block;
      padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 500; color: white;
    }

    /* ── Editor panel ────────────────────────────────────────── */
    .editor-panel {
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .editor-header {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      background: #f5f5f5;
      flex-shrink: 0;
    }

    .eh-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      mat-icon { color: #3f51b5; }
    }

    .scope-note {
      margin: 0;
      font-size: 12px;
      color: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* Scrollable body containing editor + staging */
    .editor-body {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    /* Actions bar pinned at bottom of panel */
    .actions-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid rgba(0,0,0,0.08);
      background: #fafafa;
      flex-shrink: 0;
    }

    .saved-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #2e7d32;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    /* ── Staging section ─────────────────────────────────────── */
    .staging-section {
      padding: 16px;
    }

    .staging-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      h4 { margin: 0; font-size: 14px; font-weight: 600; }
    }

    .staging-hint {
      margin: 0;
      font-size: 12px;
      color: rgba(0,0,0,0.45);
      font-style: italic;
    }

    /* Stats chips */
    .staging-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      mat-icon { font-size: 14px; }
    }

    .stat-total { background: #e8eaf6; color: #3f51b5; }
    .stat-err   { background: #ffebee; color: #c62828; }
    .stat-warn  { background: #fff3e0; color: #e65100; }
    .stat-ok    { background: #e8f5e9; color: #2e7d32; }
    .stat-info  { background: #f5f5f5; color: rgba(0,0,0,0.5); }

    /* Staged records table */
    .staged-scroll {
      overflow-x: auto;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 4px;
    }

    .staged-table {
      border-collapse: collapse;
      font-size: 12px;
      white-space: nowrap;
      width: 100%;

      th {
        background: #3f51b5;
        color: white;
        padding: 7px 12px;
        text-align: left;
        font-weight: 500;
        border-right: 1px solid rgba(255,255,255,0.15);
        position: sticky;
        top: 0;
      }

      td {
        padding: 5px 12px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        border-right: 1px solid rgba(0,0,0,0.04);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status-col { width: 36px; text-align: center; }

      tbody tr:nth-child(even) { background: #fafafa; }
      tbody tr:hover           { background: #e8eaf6; }
    }

    .staged-row-err { background: #fff8f8 !important; }

    .row-err-icon { font-size: 16px; color: #e53935; cursor: help; }
    .row-ok-icon  { font-size: 16px; color: #43a047; }

    .cell-null { color: rgba(0,0,0,0.3); font-style: italic; }
  `],
})
export class MappingComponent {
  ws           = inject(WorkspaceService);
  db           = inject(LocalDbService);
  targetSchema = inject(TargetSchemaService);
  transformer  = inject(TransformService);
  private validator = inject(ValidationRulesService);
  private toast    = inject(ToastService);
  private wfStatus = inject(WorkflowStatusService);

  fileRecords   = signal<FileRecord[]>([]);
  selectedFile  = signal<FileRecord | null>(null);
  savedMappings = signal<Map<Category, Mapping>>(new Map());

  // Passed to editor — updated ONLY when loading a new file/mapping (not on every edit)
  editorInitValue = signal<Record<string, string>>({});
  // Tracks the live editing state
  currentMapping  = signal<Record<string, string>>({});

  isSaving    = signal(false);
  isLoading   = signal(false);
  savedAt     = signal<string | null>(null);

  isGenerating  = signal(false);
  stagingResult = signal<StagingResult | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  targetFields = computed<TargetSchemaField[]>(() => {
    const f = this.selectedFile();
    return f ? this.targetSchema.fieldsFor(f.classification.category) : [];
  });

  sourceColumns = computed<string[]>(() =>
    this.selectedFile()?.parse.headers ?? []
  );

  hasSavedMappingForFile = computed(() => {
    const f = this.selectedFile();
    return f ? this.savedMappings().has(f.classification.category) : false;
  });

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (wsId) this.load();
      else {
        this.fileRecords.set([]);
        this.selectedFile.set(null);
      }
    });
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    const wsId = this.ws.activeId();
    if (!wsId) return;

    this.isLoading.set(true);
    const [files, results, classifications, mappings] = await Promise.all([
      this.db.listRawFilesByWorkspace(wsId),
      this.db.listParseResultsByWorkspace(wsId),
      this.db.listClassificationsByWorkspace(wsId),
      this.db.listMappingsByWorkspace(wsId),
    ]);

    const parseMap   = new Map(results.map(r => [r.fileId, r]));
    const classMap   = new Map(classifications.map(c => [c.fileId, c]));
    const mappingMap = new Map<Category, Mapping>(mappings.map(m => [m.category, m]));

    const records: FileRecord[] = files
      .filter(f => classMap.has(f.id) && parseMap.has(f.id))
      .map(f => ({
        file:           f,
        classification: classMap.get(f.id)!,
        parse:          parseMap.get(f.id)!,
      }))
      .sort((a, b) => a.file.importedAt.localeCompare(b.file.importedAt));

    this.fileRecords.set(records);
    this.savedMappings.set(mappingMap);

    const currentId = this.selectedFile()?.file.id;
    if (currentId) {
      const refreshed = records.find(r => r.file.id === currentId);
      if (refreshed) await this.selectFile(refreshed, true);
      else this.selectedFile.set(null);
    }

    this.isLoading.set(false);
  }

  // ── File selection ─────────────────────────────────────────────────────────

  async selectFile(record: FileRecord, reload = false): Promise<void> {
    if (!reload && this.selectedFile()?.file.id === record.file.id) return;

    this.selectedFile.set(record);
    this.savedAt.set(null);
    this.stagingResult.set(null);

    const saved = this.savedMappings().get(record.classification.category);
    const init  = saved?.mappings ?? {};

    this.editorInitValue.set({ ...init });
    this.currentMapping.set({ ...init });
  }

  // ── Editor events ──────────────────────────────────────────────────────────

  onMappingChange(mappings: Record<string, string>): void {
    this.currentMapping.set(mappings);
    this.savedAt.set(null);
  }

  // ── Save mapping ───────────────────────────────────────────────────────────

  async saveMapping(): Promise<void> {
    const wsId = this.ws.activeId();
    const file  = this.selectedFile();
    if (!wsId || !file) return;

    this.isSaving.set(true);
    const now = new Date().toISOString();
    const mapping: Mapping = {
      workspaceId: wsId,
      category:    file.classification.category,
      mappings:    this.currentMapping(),
      updatedAt:   now,
    };
    await this.db.putMapping(mapping);
    this.savedMappings.update(m => new Map(m).set(mapping.category, mapping));
    this.savedAt.set(now.slice(0, 16).replace('T', ' '));
    this.isSaving.set(false);
    this.toast.success(`Mapping saved for ${mapping.category}`);
    this.wfStatus.refresh();
  }

  // ── Clear mapping ──────────────────────────────────────────────────────────

  clearMapping(): void {
    this.editorInitValue.set({});
    this.currentMapping.set({});
    this.savedAt.set(null);
    this.stagingResult.set(null);
  }

  // ── Generate staging preview ───────────────────────────────────────────────

  async generateStaging(): Promise<void> {
    const wsId  = this.ws.activeId();
    const file  = this.selectedFile();
    if (!wsId || !file) return;

    const mapping = this.savedMappings().get(file.classification.category);
    if (!mapping) return;

    const fields = this.targetSchema.fieldsFor(file.classification.category);

    this.isGenerating.set(true);
    this.stagingResult.set(null);

    try {
      // Delete stale staged records for this file first
      await this.db.deleteStagedByFile(file.file.id);

      // Transform ALL rows (re-parses raw content if available)
      const raw = await this.transformer.transformFile(
        file.file,
        file.parse.previewRows,
        mapping,
        fields,
      );

      // Run validation (built-in + any custom rules for this workspace + category)
      const customRules = await this.db.listValidationRulesByCategory(wsId, file.classification.category);
      const allRules    = [...builtInRulesFor(file.classification.category), ...customRules];
      const records     = this.validator.validateRecords(raw, allRules);

      // Bulk-persist to IndexedDB
      await this.db.putStagedRecords(records);

      const errorCount           = records.filter(r => r.errors.length > 0).length;
      const validationIssueCount = records.filter(r => (r.validationIssues?.length ?? 0) > 0).length;
      this.stagingResult.set({
        totalRecords: records.length,
        errorCount,
        validationIssueCount,
        preview: records.slice(0, PREVIEW_LIMIT),
      });
      const parts: string[] = [`${records.length} records staged`];
      if (errorCount)           parts.push(`${errorCount} transform error${errorCount > 1 ? 's' : ''}`);
      if (validationIssueCount) parts.push(`${validationIssueCount} validation issue${validationIssueCount > 1 ? 's' : ''}`);
      this.toast.success(parts.join(' · '));
      this.wfStatus.refresh();
    } finally {
      this.isGenerating.set(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  hasSavedMapping(rec: FileRecord): boolean {
    return this.savedMappings().has(rec.classification.category);
  }

  catColor(cat: Category): string {
    return CATEGORY_COLOR[cat] ?? '#777';
  }

  isCsv(file: RawFile): boolean {
    return file.filename.toLowerCase().endsWith('.csv');
  }

  isSelected(rec: FileRecord): boolean {
    return this.selectedFile()?.file.id === rec.file.id;
  }
}
