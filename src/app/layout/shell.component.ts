import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { WorkspaceService } from '../services/workspace.service';
import { WorkflowProgressComponent } from '../shared/workflow-progress.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatSidenavModule, MatListModule,
    MatIconModule, MatChipsModule, MatButtonModule,
    WorkflowProgressComponent,
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav mode="side" opened class="sidenav">
        <div class="nav-logo">
          <mat-icon>wine_bar</mat-icon>
          <span>Migration PoC</span>
        </div>

        <mat-nav-list>
          @for (item of navItems; track item.path) {
            <a mat-list-item
               [routerLink]="item.path"
               routerLinkActive="active-link"
               [routerLinkActiveOptions]="{ exact: item.path === '/' }">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary" class="top-toolbar">
          <span>Data Migration PoC</span>
          <span class="spacer"></span>
          @if (ws.activeWorkspace(); as active) {
            <mat-chip color="accent" highlighted>
              <mat-icon matChipAvatar>folder_open</mat-icon>
              {{ active.name }}
            </mat-chip>
          } @else {
            <span class="no-workspace">No workspace selected</span>
          }
        </mat-toolbar>

        @if (ws.activeWorkspace()) {
          <app-workflow-progress />
        }

        <div class="content">
          <router-outlet />
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container { height: 100vh; }

    .sidenav {
      width: 220px;
      background: #1a237e;
      color: white;
    }

    .nav-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 12px;
      font-size: 16px;
      font-weight: 500;
      color: white;
      border-bottom: 1px solid rgba(255,255,255,0.15);
      margin-bottom: 8px;

      mat-icon { color: #ffd740; }
    }

    .sidenav mat-nav-list a {
      color: rgba(255,255,255,0.85);

      mat-icon { color: rgba(255,255,255,0.7); }

      &:hover { background: rgba(255,255,255,0.08); }
      &.active-link {
        background: rgba(255,255,255,0.15);
        color: white;
        mat-icon { color: #ffd740; }
      }
    }

    .top-toolbar { position: sticky; top: 0; z-index: 10; }

    .no-workspace {
      font-size: 13px;
      opacity: 0.7;
      font-style: italic;
    }

    .content { overflow-y: auto; }
  `],
})
export class ShellComponent {
  ws = inject(WorkspaceService);

  navItems: NavItem[] = [
    { path: '/',          label: 'Home',     icon: 'home' },
    { path: '/import',    label: 'Import',   icon: 'upload_file' },
    { path: '/review',    label: 'Review',   icon: 'fact_check' },
    { path: '/mapping',   label: 'Mapping',  icon: 'schema' },
    { path: '/export',    label: 'Export',   icon: 'download' },
    { path: '/settings',       label: 'Settings',     icon: 'settings' },
    { path: '/inspector',      label: 'Inspector',    icon: 'storage' },
    { path: '/lot-normalizer', label: 'Lot Normalizer', icon: 'join_inner' },
    { path: '/validation',        label: 'Validation',      icon: 'rule' },
    { path: '/template-mapping', label: 'Template Mapping', icon: 'table_view' },
  ];
}
