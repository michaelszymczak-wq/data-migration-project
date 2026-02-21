import { Injectable, signal, computed } from '@angular/core';
import { Workspace } from '../models';
import { LocalDbService } from './local-db.service';

const ACTIVE_KEY = 'activeWorkspaceId';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private _workspaces = signal<Workspace[]>([]);
  private _activeId   = signal<string | null>(localStorage.getItem(ACTIVE_KEY));

  readonly workspaces   = this._workspaces.asReadonly();
  readonly activeId     = this._activeId.asReadonly();
  readonly activeWorkspace = computed(() =>
    this._workspaces().find(w => w.id === this._activeId()) ?? null
  );

  constructor(private db: LocalDbService) {
    this.load();
  }

  async load(): Promise<void> {
    const list = await this.db.listWorkspaces();
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    this._workspaces.set(list);
  }

  async create(name: string): Promise<Workspace> {
    const now = new Date().toISOString();
    const ws: Workspace = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.createWorkspace(ws);
    await this.load();
    return ws;
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteWorkspace(id);
    if (this._activeId() === id) this.setActive(null);
    await this.load();
  }

  setActive(id: string | null): void {
    this._activeId.set(id);
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }
}
