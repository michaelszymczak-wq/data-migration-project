import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { WorkspaceService } from '../../services/workspace.service';
import { Workspace } from '../../models';
import { CreateWorkspaceDialogComponent } from './create-workspace-dialog.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink, FormsModule, SlicePipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatDialogModule, MatDividerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2>Workspaces</h2>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          New Workspace
        </button>
      </div>

      @if (ws.workspaces().length === 0) {
        <div class="empty-state">
          <mat-icon>folder_open</mat-icon>
          <h3>No workspaces yet</h3>
          <p>Create a workspace to get started with your migration.</p>
          <button mat-raised-button color="primary" (click)="openCreate()">
            Create Workspace
          </button>
        </div>
      }

      <div class="workspace-grid">
        @for (w of ws.workspaces(); track w.id) {
          <mat-card
            [class.active-card]="w.id === ws.activeId()"
            class="workspace-card">
            <mat-card-header>
              <mat-icon mat-card-avatar color="primary">folder</mat-icon>
              <mat-card-title>{{ w.name }}</mat-card-title>
              <mat-card-subtitle>
                Created {{ w.createdAt | slice:0:10 }}
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-actions align="end">
              @if (w.id === ws.activeId()) {
                <span class="active-badge">
                  <mat-icon inline>check_circle</mat-icon> Active
                </span>
              }
              <button mat-button color="warn" (click)="deleteWs(w)">
                <mat-icon>delete</mat-icon>
              </button>
              <button mat-raised-button color="primary"
                      (click)="openWs(w)"
                      [routerLink]="['/import']">
                Open
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    .workspace-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .workspace-card {
      transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    }

    .active-card {
      border: 2px solid #3f51b5;
    }

    .active-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #3f51b5;
      font-size: 13px;
      font-weight: 500;
      margin-right: auto;
      padding-left: 8px;
    }
  `],
})
export class HomeComponent {
  ws = inject(WorkspaceService);
  private dialog = inject(MatDialog);

  openCreate(): void {
    this.dialog
      .open(CreateWorkspaceDialogComponent, { width: '380px' })
      .afterClosed()
      .subscribe((name: string | undefined) => {
        if (name) this.ws.create(name);
      });
  }

  openWs(w: Workspace): void {
    this.ws.setActive(w.id);
  }

  async deleteWs(w: Workspace): Promise<void> {
    if (confirm(`Delete workspace "${w.name}"? This cannot be undone.`)) {
      await this.ws.delete(w.id);
    }
  }
}
