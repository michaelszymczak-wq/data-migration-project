import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { WorkspaceService } from './workspace.service';
import { LocalDbService } from './local-db.service';

interface Counts {
  files: number;
  classified: number;
  mappings: number;
  staged: number;
}

@Injectable({ providedIn: 'root' })
export class WorkflowStatusService {
  private ws = inject(WorkspaceService);
  private db = inject(LocalDbService);

  private counts = signal<Counts>({ files: 0, classified: 0, mappings: 0, staged: 0 });

  readonly importDone  = computed(() => this.counts().files > 0);
  readonly reviewDone  = computed(() => this.counts().classified > 0);
  readonly mappingDone = computed(() => this.counts().mappings > 0);
  readonly stagingDone = computed(() => this.counts().staged > 0);

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (wsId) {
        this.refresh(wsId);
      } else {
        this.counts.set({ files: 0, classified: 0, mappings: 0, staged: 0 });
      }
    });
  }

  /** Call after any operation that changes files / classifications / mappings / staged records. */
  async refresh(wsId?: string): Promise<void> {
    const id = wsId ?? this.ws.activeId();
    if (!id) return;
    const [files, cls, maps, staged] = await Promise.all([
      this.db.listRawFilesByWorkspace(id),
      this.db.listClassificationsByWorkspace(id),
      this.db.listMappingsByWorkspace(id),
      this.db.listStagedByWorkspace(id),
    ]);
    this.counts.set({
      files:      files.length,
      classified: cls.length,
      mappings:   maps.length,
      staged:     staged.length,
    });
  }
}
