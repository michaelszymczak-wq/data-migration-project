import {
  Component, inject, signal, computed, effect,
  ViewChild, ElementRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkspaceService } from '../../services/workspace.service';
import { LocalDbService } from '../../services/local-db.service';
import { ParseService } from '../../services/parse.service';
import { SampleDataService } from '../../services/sample-data.service';
import { ToastService } from '../../services/toast.service';
import { WorkflowStatusService } from '../../services/workflow-status.service';
import { NoWorkspaceComponent } from '../../shared/no-workspace.component';
import { RawFile, ParseResult } from '../../models';

interface FileEntry {
  raw: RawFile;
  parse?: ParseResult;
  status: 'parsing' | 'done' | 'error';
  error?: string;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [
    DecimalPipe,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule,
    NoWorkspaceComponent,
  ],
  template: `
    @if (!ws.activeWorkspace()) {
      <app-no-workspace />
    } @else {
      <div class="page-container">

        <!-- Header -->
        <div class="page-header">
          <mat-icon>upload_file</mat-icon>
          <h2>Import Files</h2>
          <span class="spacer"></span>
          <span class="ws-label">{{ ws.activeWorkspace()!.name }}</span>
        </div>

        <!-- Drop zone -->
        <div
          class="dropzone"
          [class.drag-over]="isDragOver()"
          (dragover)="onDragOver($event)"
          (dragleave)="isDragOver.set(false)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()">
          <mat-icon class="drop-icon">cloud_upload</mat-icon>
          <p class="drop-primary">Drop CSV or XLSX files here</p>
          <p class="drop-hint">or click to browse &nbsp;·&nbsp; .csv and .xlsx supported</p>
        </div>
        <input
          #fileInput
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          style="display:none"
          (change)="onFileInput($event)">

        <!-- Sample data loader -->
        <div class="sample-bar">
          <mat-icon style="font-size:16px;width:16px;height:16px;color:#888">science</mat-icon>
          <span>No data to import?</span>
          <button mat-stroked-button [disabled]="loadingSamples()" (click)="loadSamples()">
            @if (loadingSamples()) { <mat-spinner diameter="14" /> }
            @else { <mat-icon>download</mat-icon> }
            Load {{ samples.count }} sample files
          </button>
        </div>

        <!-- Empty state: no files yet -->
        @if (!isLoading() && entries().length === 0) {
          <div class="empty-state" style="margin-top:32px">
            <mat-icon>inbox</mat-icon>
            <p>No files imported yet — drop files above or load samples.</p>
          </div>
        }

        <!-- Loading -->
        @if (isLoading()) {
          <div class="empty-state" style="margin-top:32px">
            <mat-spinner diameter="36"></mat-spinner>
          </div>
        }

        <!-- Main layout: file list + preview -->
        @if (!isLoading() && entries().length > 0) {
          <div class="import-layout">

            <!-- ── File list panel ─────────────────────────────────── -->
            <div class="file-list-panel">
              <div class="panel-header">
                Files <span class="count">({{ entries().length }})</span>
              </div>

              @for (entry of entries(); track entry.raw.id) {
                <div
                  class="file-item"
                  [class.selected]="selectedId() === entry.raw.id"
                  (click)="select(entry)">

                  <div class="file-main">
                    <mat-icon class="type-icon">
                      {{ isCsv(entry.raw) ? 'description' : 'table_chart' }}
                    </mat-icon>
                    <div class="file-info">
                      <span class="file-name" [title]="entry.raw.filename">
                        {{ entry.raw.filename }}
                      </span>
                      <span class="file-meta">{{ entry.raw.size | number }} bytes</span>
                    </div>
                  </div>

                  <div class="file-badges">
                    @if (entry.status === 'parsing') {
                      <mat-spinner diameter="16" />
                    } @else if (entry.status === 'error') {
                      <span class="badge badge-error" [matTooltip]="entry.error ?? ''">Error</span>
                    } @else {
                      <span class="badge badge-ok">
                        {{ entry.parse?.rowCount | number }} rows
                      </span>
                    }
                    @if (entry.status !== 'parsing') {
                      <button
                        mat-icon-button
                        class="del-btn"
                        matTooltip="Remove file"
                        (click)="deleteFile($event, entry)">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </div>

                </div>
              }
            </div>

            <!-- ── Preview panel ───────────────────────────────────── -->
            <div class="preview-panel">

              @if (!selectedEntry()) {
                <div class="empty-state">
                  <mat-icon>table_view</mat-icon>
                  <p>Select a file to preview its contents.</p>
                </div>

              } @else if (selectedEntry()!.status === 'parsing') {
                <div class="empty-state">
                  <mat-spinner diameter="36" />
                  <p>Parsing {{ selectedEntry()!.raw.filename }}…</p>
                </div>

              } @else if (selectedEntry()!.status === 'error') {
                <div class="empty-state error-state">
                  <mat-icon color="warn">error_outline</mat-icon>
                  <strong>Parse failed</strong>
                  <p>{{ selectedEntry()!.error }}</p>
                </div>

              } @else {
                <div class="preview-content">

                  <!-- Stats bar -->
                  <div class="preview-stats">
                    <strong>{{ selectedEntry()!.raw.filename }}</strong>
                    <span class="stat-chip">
                      {{ selectedEntry()!.parse?.rowCount | number }} rows
                    </span>
                    <span class="stat-chip">
                      {{ selectedEntry()!.parse?.headers?.length ?? 0 }} columns
                    </span>
                    <span class="stat-chip">
                      {{ selectedEntry()!.raw.size | number }} bytes
                    </span>
                  </div>

                  <!-- Parse warnings -->
                  @if ((selectedEntry()!.parse?.errors?.length ?? 0) > 0) {
                    <div class="parse-warnings">
                      <mat-icon>warning</mat-icon>
                      {{ selectedEntry()!.parse!.errors.length }} warning(s):
                      {{ selectedEntry()!.parse!.errors.slice(0, 2).join(' · ') }}
                    </div>
                  }

                  <p class="preview-caption">
                    Showing first {{ selectedEntry()!.parse?.previewRows?.length ?? 0 }}
                    of {{ selectedEntry()!.parse?.rowCount | number }} rows
                  </p>

                  <!-- Preview table (plain HTML for dynamic columns) -->
                  <div class="table-scroll">
                    <table class="preview-table">
                      <thead>
                        <tr>
                          @for (col of selectedEntry()!.parse?.headers ?? []; track col) {
                            <th>{{ col }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of selectedEntry()!.parse?.previewRows ?? []; track $index) {
                          <tr>
                            @for (col of selectedEntry()!.parse?.headers ?? []; track col) {
                              <td>{{ row[col] }}</td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                </div>
              }

            </div>
          </div>
        }

      </div>
    }
  `,
  styles: [`
    .ws-label {
      font-size: 13px;
      color: rgba(0,0,0,0.5);
      font-style: italic;
    }

    .sample-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; margin-bottom: 12px;
      background: #f9f9f9; border-radius: 6px; border: 1px solid #eee;
      font-size: 13px; color: #777;
    }

    /* ── Drop zone ───────────────────────────────────────────── */
    .dropzone {
      border: 2px dashed rgba(0,0,0,0.2);
      border-radius: 8px;
      padding: 36px 24px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      user-select: none;

      &:hover, &.drag-over {
        border-color: #3f51b5;
        background: rgba(63,81,181,0.04);
      }
    }

    .drop-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #3f51b5;
      opacity: 0.7;
    }

    .drop-primary {
      margin: 8px 0 4px;
      font-size: 15px;
      font-weight: 500;
      color: rgba(0,0,0,0.7);
    }

    .drop-hint {
      margin: 0;
      font-size: 12px;
      color: rgba(0,0,0,0.4);
    }

    /* ── Main layout ─────────────────────────────────────────── */
    .import-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 16px;
      margin-top: 16px;
      height: calc(100vh - 310px);
      min-height: 360px;
    }

    /* ── File list panel ─────────────────────────────────────── */
    .file-list-panel {
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 6px;
      overflow-y: auto;
      background: #fafafa;
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(0,0,0,0.05);
      transition: background 0.15s;

      &:hover { background: rgba(0,0,0,0.04); }
      &.selected { background: rgba(63,81,181,0.08); }
    }

    .file-main {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .type-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #3f51b5;
      flex-shrink: 0;
    }

    .file-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .file-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }

    .file-meta {
      font-size: 11px;
      color: rgba(0,0,0,0.4);
    }

    .file-badges {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .badge {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 500;
    }

    .badge-ok {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .badge-error {
      background: #ffebee;
      color: #c62828;
      cursor: help;
    }

    .del-btn {
      width: 24px;
      height: 24px;
      line-height: 24px;
      mat-icon { font-size: 16px; color: rgba(0,0,0,0.35); }
      &:hover mat-icon { color: #c62828; }
    }

    /* ── Preview panel ───────────────────────────────────────── */
    .preview-panel {
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .preview-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .preview-stats {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      background: #f5f5f5;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .stat-chip {
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      background: #e8eaf6;
      color: #3f51b5;
      font-weight: 500;
    }

    .parse-warnings {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #fff8e1;
      font-size: 12px;
      color: #f57f17;
      flex-shrink: 0;

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .preview-caption {
      margin: 0;
      padding: 6px 16px;
      font-size: 11px;
      color: rgba(0,0,0,0.4);
      flex-shrink: 0;
    }

    .table-scroll {
      overflow: auto;
      flex: 1;
    }

    /* ── Preview table ───────────────────────────────────────── */
    .preview-table {
      border-collapse: collapse;
      font-size: 12px;
      white-space: nowrap;
      width: 100%;

      th {
        position: sticky;
        top: 0;
        background: #3f51b5;
        color: white;
        padding: 8px 14px;
        text-align: left;
        font-weight: 500;
        border-right: 1px solid rgba(255,255,255,0.15);
        z-index: 1;
      }

      td {
        padding: 6px 14px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        border-right: 1px solid rgba(0,0,0,0.04);
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      tbody tr:nth-child(even) { background: #f9f9f9; }
      tbody tr:hover { background: #e8eaf6; }
    }

    /* ── Error state ─────────────────────────────────────────── */
    .error-state {
      color: #c62828;
      mat-icon { color: #c62828; }
    }
  `],
})
export class ImportComponent {
  ws      = inject(WorkspaceService);
  db      = inject(LocalDbService);
  parser  = inject(ParseService);
  samples = inject(SampleDataService);
  private toast   = inject(ToastService);
  private wfStatus = inject(WorkflowStatusService);

  entries       = signal<FileEntry[]>([]);
  selectedId    = signal<string | null>(null);
  isDragOver    = signal(false);
  isLoading     = signal(false);
  loadingSamples = signal(false);

  selectedEntry = computed(() =>
    this.entries().find(e => e.raw.id === this.selectedId()) ?? null
  );

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (wsId) {
        this.load();
      } else {
        this.entries.set([]);
        this.selectedId.set(null);
      }
    });
  }

  async load(): Promise<void> {
    const wsId = this.ws.activeId();
    if (!wsId) return;

    this.isLoading.set(true);
    const [files, results] = await Promise.all([
      this.db.listRawFilesByWorkspace(wsId),
      this.db.listParseResultsByWorkspace(wsId),
    ]);
    const resultMap = new Map(results.map(r => [r.fileId, r]));
    const sorted = [...files].sort((a, b) => a.importedAt.localeCompare(b.importedAt));

    this.entries.set(sorted.map(f => ({
      raw: f,
      parse: resultMap.get(f.id),
      status: resultMap.has(f.id) ? 'done' : 'error',
      error: resultMap.has(f.id) ? undefined : 'Parse result missing',
    })));
    this.isLoading.set(false);
  }

  // ── Sample data ────────────────────────────────────────────────────────────

  async loadSamples(): Promise<void> {
    if (this.loadingSamples()) return;
    this.loadingSamples.set(true);
    const files = this.samples.getFiles();
    await Promise.all(files.map(f => this.ingestFile(f)));
    this.loadingSamples.set(false);
    this.toast.success(`${files.length} sample files loaded.`);
    this.wfStatus.refresh();
  }

  // ── Drag / drop ────────────────────────────────────────────────────────────

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(true);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver.set(false);
    const files = e.dataTransfer?.files;
    if (files?.length) this.ingestFiles(files);
  }

  onFileInput(e: Event): void {
    const files = (e.target as HTMLInputElement).files;
    if (files?.length) this.ingestFiles(files);
    (e.target as HTMLInputElement).value = '';
  }

  private ingestFiles(fileList: FileList): void {
    Array.from(fileList).forEach(f => this.ingestFile(f));
  }

  // ── Core ingest pipeline ───────────────────────────────────────────────────

  private async ingestFile(file: File): Promise<void> {
    const wsId = this.ws.activeId();
    if (!wsId) return;

    const id  = crypto.randomUUID();
    const now = new Date().toISOString();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    // 1. Add placeholder so the file appears in the list immediately
    const placeholder: FileEntry = {
      raw: {
        id, workspaceId: wsId,
        filename: file.name,
        size: file.size,
        mimeType: file.type || `application/${ext}`,
        importedAt: now,
      },
      status: 'parsing',
    };
    this.entries.update(list => [...list, placeholder]);
    this.selectedId.set(id);

    try {
      // 2. Parse + read content (one read pass each; File is in-memory so double-read is fine)
      const [parseOutput, contentText, rawBuffer] = await Promise.all([
        this.parser.parse(file),
        ext === 'csv' ? file.text() : Promise.resolve(null),
        ext !== 'csv' ? file.arrayBuffer() : Promise.resolve(null),
      ]);

      const contentBlob = rawBuffer
        ? new Blob([rawBuffer], { type: file.type })
        : null;

      const rawFile: RawFile = {
        id, workspaceId: wsId,
        filename: file.name,
        size: file.size,
        mimeType: file.type || `application/${ext}`,
        importedAt: now,
        contentText,
        contentBlob,
      };

      const parseResult: ParseResult = {
        fileId: id,
        workspaceId: wsId,
        headers: parseOutput.headers,
        rowCount: parseOutput.rowCount,
        previewRows: parseOutput.previewRows,
        errors: parseOutput.errors,
        createdAt: now,
      };

      // 3. Persist both together
      await Promise.all([
        this.db.putRawFile(rawFile),
        this.db.putParseResult(parseResult),
      ]);

      // 4. Replace placeholder with completed entry
      this.entries.update(list =>
        list.map(e => e.raw.id === id
          ? { raw: rawFile, parse: parseResult, status: 'done' as const }
          : e
        )
      );
      this.toast.success(`Imported "${file.name}" — ${parseOutput.rowCount} rows`);
      this.wfStatus.refresh();

    } catch (err) {
      this.entries.update(list =>
        list.map(e => e.raw.id === id
          ? { ...e, status: 'error' as const, error: String(err) }
          : e
        )
      );
      this.toast.error(`Failed to import "${file.name}": ${String(err)}`);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async deleteFile(event: Event, entry: FileEntry): Promise<void> {
    event.stopPropagation();
    await Promise.all([
      this.db.deleteRawFile(entry.raw.id),
      this.db.deleteParseResult(entry.raw.id),
    ]);
    this.entries.update(list => list.filter(e => e.raw.id !== entry.raw.id));
    if (this.selectedId() === entry.raw.id) this.selectedId.set(null);
    this.toast.info(`Removed "${entry.raw.filename}"`);
    this.wfStatus.refresh();
  }

  select(entry: FileEntry): void {
    this.selectedId.set(entry.raw.id);
  }

  isCsv(file: RawFile): boolean {
    return file.filename.toLowerCase().endsWith('.csv') || file.mimeType === 'text/csv';
  }
}
