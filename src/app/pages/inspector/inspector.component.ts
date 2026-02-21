import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, SlicePipe, DecimalPipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { LocalDbService } from '../../services/local-db.service';
import { WorkspaceService } from '../../services/workspace.service';
import { Workspace, RawFile, Classification, ParseResult } from '../../models';

@Component({
  selector: 'app-inspector',
  standalone: true,
  imports: [
    FormsModule, DatePipe, SlicePipe, DecimalPipe,
    MatTabsModule, MatTableModule, MatSelectModule, MatFormFieldModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatChipsModule, MatCardModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <mat-icon>storage</mat-icon>
        <h2>Data Inspector</h2>
        <span class="spacer"></span>
        <button mat-raised-button color="warn" (click)="clearAll()">
          <mat-icon>delete_forever</mat-icon>
          Clear DB
        </button>
      </div>

      <!-- Workspace filter -->
      <mat-form-field appearance="outline" style="min-width:280px; margin-bottom:16px">
        <mat-label>Filter by workspace</mat-label>
        <mat-select [(ngModel)]="selectedWsId" (ngModelChange)="onWsChange()">
          <mat-option value="">— All —</mat-option>
          @for (w of workspaces(); track w.id) {
            <mat-option [value]="w.id">{{ w.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-tab-group dynamicHeight>

        <!-- ── Workspaces tab ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">folder</mat-icon>
            Workspaces ({{ workspaces().length }})
          </ng-template>

          @if (workspaces().length === 0) {
            <p class="empty-tab">No workspaces found.</p>
          } @else {
            <table mat-table [dataSource]="workspaces()" class="full-table">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let w" class="mono">{{ w.id | slice:0:8 }}…</td>
              </ng-container>
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let w"><strong>{{ w.name }}</strong></td>
              </ng-container>
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let w">{{ w.createdAt | date:'medium' }}</td>
              </ng-container>
              <ng-container matColumnDef="updatedAt">
                <th mat-header-cell *matHeaderCellDef>Updated</th>
                <td mat-cell *matCellDef="let w">{{ w.updatedAt | date:'medium' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="wsCols"></tr>
              <tr mat-row *matRowDef="let row; columns: wsCols;"></tr>
            </table>
          }
        </mat-tab>

        <!-- ── RawFiles tab ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">description</mat-icon>
            Raw Files ({{ rawFiles().length }})
          </ng-template>

          @if (rawFiles().length === 0) {
            <p class="empty-tab">No raw files stored yet. Import files in Phase 2.</p>
          } @else {
            <table mat-table [dataSource]="rawFiles()" class="full-table">
              <ng-container matColumnDef="id">
                <th mat-header-cell *matHeaderCellDef>ID</th>
                <td mat-cell *matCellDef="let f" class="mono">{{ f.id | slice:0:8 }}…</td>
              </ng-container>
              <ng-container matColumnDef="filename">
                <th mat-header-cell *matHeaderCellDef>Filename</th>
                <td mat-cell *matCellDef="let f">{{ f.filename }}</td>
              </ng-container>
              <ng-container matColumnDef="size">
                <th mat-header-cell *matHeaderCellDef>Size</th>
                <td mat-cell *matCellDef="let f">{{ f.size | number }} bytes</td>
              </ng-container>
              <ng-container matColumnDef="mimeType">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let f">{{ f.mimeType }}</td>
              </ng-container>
              <ng-container matColumnDef="importedAt">
                <th mat-header-cell *matHeaderCellDef>Imported</th>
                <td mat-cell *matCellDef="let f">{{ f.importedAt | date:'medium' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="fileCols"></tr>
              <tr mat-row *matRowDef="let row; columns: fileCols;"></tr>
            </table>
          }
        </mat-tab>

        <!-- ── Classifications tab ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">label</mat-icon>
            Classifications ({{ classifications().length }})
          </ng-template>

          @if (classifications().length === 0) {
            <p class="empty-tab">No classifications yet. Available in Phase 3.</p>
          } @else {
            <table mat-table [dataSource]="classifications()" class="full-table">
              <ng-container matColumnDef="fileId">
                <th mat-header-cell *matHeaderCellDef>File ID</th>
                <td mat-cell *matCellDef="let c" class="mono">{{ c.fileId | slice:0:8 }}…</td>
              </ng-container>
              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef>Category</th>
                <td mat-cell *matCellDef="let c">
                  <mat-chip>{{ c.category }}</mat-chip>
                </td>
              </ng-container>
              <ng-container matColumnDef="confidence">
                <th mat-header-cell *matHeaderCellDef>Confidence</th>
                <td mat-cell *matCellDef="let c">{{ c.confidence | number:'1.0-2' }}</td>
              </ng-container>
              <ng-container matColumnDef="notes">
                <th mat-header-cell *matHeaderCellDef>Notes</th>
                <td mat-cell *matCellDef="let c">{{ c.notes ?? '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let c">{{ c.createdAt | date:'medium' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="classCols"></tr>
              <tr mat-row *matRowDef="let row; columns: classCols;"></tr>
            </table>
          }
        </mat-tab>

        <!-- ── ParseResults tab ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">table_chart</mat-icon>
            Parse Results ({{ parseResults().length }})
          </ng-template>

          @if (parseResults().length === 0) {
            <p class="empty-tab">No parse results yet. Available after Phase 2 import.</p>
          } @else {
            <table mat-table [dataSource]="parseResults()" class="full-table">
              <ng-container matColumnDef="fileId">
                <th mat-header-cell *matHeaderCellDef>File ID</th>
                <td mat-cell *matCellDef="let p" class="mono">{{ p.fileId | slice:0:8 }}…</td>
              </ng-container>
              <ng-container matColumnDef="rowCount">
                <th mat-header-cell *matHeaderCellDef>Row Count</th>
                <td mat-cell *matCellDef="let p">{{ p.rowCount | number }}</td>
              </ng-container>
              <ng-container matColumnDef="headers">
                <th mat-header-cell *matHeaderCellDef>Headers</th>
                <td mat-cell *matCellDef="let p">{{ p.headers.join(', ') | slice:0:60 }}…</td>
              </ng-container>
              <ng-container matColumnDef="errors">
                <th mat-header-cell *matHeaderCellDef>Errors</th>
                <td mat-cell *matCellDef="let p">{{ p.errors.length }}</td>
              </ng-container>
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let p">{{ p.createdAt | date:'medium' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="parseCols"></tr>
              <tr mat-row *matRowDef="let row; columns: parseCols;"></tr>
            </table>
          }
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .full-table { width: 100%; margin-bottom: 16px; }
    .mono { font-family: monospace; font-size: 12px; color: #555; }
    .empty-tab { padding: 32px 16px; color: rgba(0,0,0,0.5); font-style: italic; }
    .tab-icon { margin-right: 6px; font-size: 18px; }
  `],
})
export class InspectorComponent implements OnInit {
  private dbSvc  = inject(LocalDbService);
  private wsSvc  = inject(WorkspaceService);

  workspaces      = signal<Workspace[]>([]);
  rawFiles        = signal<RawFile[]>([]);
  classifications = signal<Classification[]>([]);
  parseResults    = signal<ParseResult[]>([]);

  selectedWsId = '';

  wsCols    = ['id', 'name', 'createdAt', 'updatedAt'];
  fileCols  = ['id', 'filename', 'size', 'mimeType', 'importedAt'];
  classCols = ['fileId', 'category', 'confidence', 'notes', 'createdAt'];
  parseCols = ['fileId', 'rowCount', 'headers', 'errors', 'createdAt'];

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const allWs = await this.dbSvc.listWorkspaces();
    this.workspaces.set(allWs);

    if (this.selectedWsId) {
      this.rawFiles.set(await this.dbSvc.listRawFilesByWorkspace(this.selectedWsId));
      this.classifications.set(await this.dbSvc.listClassificationsByWorkspace(this.selectedWsId));
      this.parseResults.set(await this.dbSvc.listParseResultsByWorkspace(this.selectedWsId));
    } else {
      // load all when no filter
      const files: RawFile[]  = [];
      const cls: Classification[] = [];
      const prs: ParseResult[] = [];
      for (const w of allWs) {
        files.push(...await this.dbSvc.listRawFilesByWorkspace(w.id));
        cls.push(...await this.dbSvc.listClassificationsByWorkspace(w.id));
        prs.push(...await this.dbSvc.listParseResultsByWorkspace(w.id));
      }
      this.rawFiles.set(files);
      this.classifications.set(cls);
      this.parseResults.set(prs);
    }
  }

  async onWsChange(): Promise<void> {
    await this.load();
  }

  async clearAll(): Promise<void> {
    if (confirm('This will permanently delete ALL data from IndexedDB. Are you sure?')) {
      await this.dbSvc.clearAll();
      this.wsSvc.setActive(null);
      await this.wsSvc.load();
      this.selectedWsId = '';
      await this.load();
    }
  }
}
