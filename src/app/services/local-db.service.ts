import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { Workspace, RawFile, Classification, ParseResult, Mapping, StagedRecord, Category, NormalizedLotComposition, ValidationRule } from '../models';

const DB_NAME = 'migration-poc';
const DB_VERSION = 5;

@Injectable({ providedIn: 'root' })
export class LocalDbService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // ── Version 1 stores ───────────────────────────────────────────────────
        if (oldVersion < 1) {
          const ws = db.createObjectStore('workspaces', { keyPath: 'id' });
          ws.createIndex('updatedAt', 'updatedAt');

          const rf = db.createObjectStore('rawFiles', { keyPath: 'id' });
          rf.createIndex('workspaceId', 'workspaceId');
          rf.createIndex('importedAt', 'importedAt');

          const cl = db.createObjectStore('classifications', { keyPath: 'fileId' });
          cl.createIndex('workspaceId', 'workspaceId');
          cl.createIndex('category', 'category');

          const pr = db.createObjectStore('parseResults', { keyPath: 'fileId' });
          pr.createIndex('workspaceId', 'workspaceId');
        }

        // ── Version 2 stores ───────────────────────────────────────────────────
        if (oldVersion < 2) {
          // Compound key: one mapping per (workspace, category)
          const mp = db.createObjectStore('mappings', {
            keyPath: ['workspaceId', 'category'],
          });
          mp.createIndex('workspaceId', 'workspaceId');
        }

        // ── Version 3 stores ───────────────────────────────────────────────────
        if (oldVersion < 3) {
          const sr = db.createObjectStore('stagedRecords', { keyPath: 'id' });
          sr.createIndex('workspaceId',  'workspaceId');
          sr.createIndex('sourceFileId', 'sourceFileId');
          sr.createIndex('category',     'category');
        }

        // ── Version 4 stores ───────────────────────────────────────────────────
        if (oldVersion < 4) {
          const nl = db.createObjectStore('normalizedLotCompositions', { keyPath: 'id' });
          nl.createIndex('workspaceId',  'workspaceId');
          nl.createIndex('sourceFileId', 'sourceFileId');
          nl.createIndex('lotCode',      'lotCode');
        }

        // ── Version 5 stores ───────────────────────────────────────────────────
        if (oldVersion < 5) {
          const vr = db.createObjectStore('validationRules', { keyPath: 'id' });
          vr.createIndex('workspaceId', 'workspaceId');
          vr.createIndex('category',    'category');
        }
      },
    });
  }

  private async db(): Promise<IDBPDatabase> {
    return this.dbPromise;
  }

  // ── Workspaces ──────────────────────────────────────────────────────────────

  async listWorkspaces(): Promise<Workspace[]> {
    return (await this.db()).getAll('workspaces');
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    return (await this.db()).get('workspaces', id);
  }

  async createWorkspace(ws: Workspace): Promise<void> {
    await (await this.db()).put('workspaces', ws);
  }

  async updateWorkspace(ws: Workspace): Promise<void> {
    await (await this.db()).put('workspaces', ws);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await (await this.db()).delete('workspaces', id);
  }

  // ── RawFiles ────────────────────────────────────────────────────────────────

  async listRawFilesByWorkspace(workspaceId: string): Promise<RawFile[]> {
    const db = await this.db();
    return db.getAllFromIndex('rawFiles', 'workspaceId', workspaceId);
  }

  async getRawFile(id: string): Promise<RawFile | undefined> {
    return (await this.db()).get('rawFiles', id);
  }

  async putRawFile(file: RawFile): Promise<void> {
    await (await this.db()).put('rawFiles', file);
  }

  async deleteRawFile(id: string): Promise<void> {
    await (await this.db()).delete('rawFiles', id);
  }

  // ── Classifications ─────────────────────────────────────────────────────────

  async listClassificationsByWorkspace(workspaceId: string): Promise<Classification[]> {
    const db = await this.db();
    return db.getAllFromIndex('classifications', 'workspaceId', workspaceId);
  }

  async putClassification(c: Classification): Promise<void> {
    await (await this.db()).put('classifications', c);
  }

  async deleteClassification(fileId: string): Promise<void> {
    await (await this.db()).delete('classifications', fileId);
  }

  // ── ParseResults ────────────────────────────────────────────────────────────

  async listParseResultsByWorkspace(workspaceId: string): Promise<ParseResult[]> {
    const db = await this.db();
    return db.getAllFromIndex('parseResults', 'workspaceId', workspaceId);
  }

  async putParseResult(pr: ParseResult): Promise<void> {
    await (await this.db()).put('parseResults', pr);
  }

  async deleteParseResult(fileId: string): Promise<void> {
    await (await this.db()).delete('parseResults', fileId);
  }

  // ── Mappings ────────────────────────────────────────────────────────────────

  async getMapping(workspaceId: string, category: Category): Promise<Mapping | undefined> {
    return (await this.db()).get('mappings', [workspaceId, category]);
  }

  async listMappingsByWorkspace(workspaceId: string): Promise<Mapping[]> {
    const db = await this.db();
    return db.getAllFromIndex('mappings', 'workspaceId', workspaceId);
  }

  async putMapping(mapping: Mapping): Promise<void> {
    await (await this.db()).put('mappings', mapping);
  }

  async deleteMapping(workspaceId: string, category: Category): Promise<void> {
    await (await this.db()).delete('mappings', [workspaceId, category]);
  }

  // ── StagedRecords ───────────────────────────────────────────────────────────

  async listStagedByWorkspace(workspaceId: string): Promise<StagedRecord[]> {
    const db = await this.db();
    return db.getAllFromIndex('stagedRecords', 'workspaceId', workspaceId);
  }

  async listStagedByFile(sourceFileId: string): Promise<StagedRecord[]> {
    const db = await this.db();
    return db.getAllFromIndex('stagedRecords', 'sourceFileId', sourceFileId);
  }

  async putStagedRecords(records: StagedRecord[]): Promise<void> {
    if (!records.length) return;
    const db = await this.db();
    const tx = db.transaction('stagedRecords', 'readwrite');
    // Fire all puts without awaiting individually — more efficient for bulk writes
    records.forEach(r => tx.store.put(r));
    await tx.done;
  }

  async deleteStagedByFile(sourceFileId: string): Promise<void> {
    const db = await this.db();
    const keys = await db.getAllKeysFromIndex('stagedRecords', 'sourceFileId', sourceFileId);
    if (!keys.length) return;
    const tx = db.transaction('stagedRecords', 'readwrite');
    keys.forEach(k => tx.store.delete(k));
    await tx.done;
  }

  // ── ParseResults (single getter) ─────────────────────────────────────────────

  async getParseResult(fileId: string): Promise<ParseResult | undefined> {
    return (await this.db()).get('parseResults', fileId);
  }

  // ── NormalizedLotCompositions ────────────────────────────────────────────────

  async listNormalizedByWorkspace(workspaceId: string): Promise<NormalizedLotComposition[]> {
    const db = await this.db();
    return db.getAllFromIndex('normalizedLotCompositions', 'workspaceId', workspaceId);
  }

  async listNormalizedByFile(sourceFileId: string): Promise<NormalizedLotComposition[]> {
    const db = await this.db();
    return db.getAllFromIndex('normalizedLotCompositions', 'sourceFileId', sourceFileId);
  }

  async putNormalizedRecords(records: NormalizedLotComposition[]): Promise<void> {
    if (!records.length) return;
    const db = await this.db();
    const tx = db.transaction('normalizedLotCompositions', 'readwrite');
    records.forEach(r => tx.store.put(r));
    await tx.done;
  }

  // ── ValidationRules ──────────────────────────────────────────────────────────

  async listValidationRulesByWorkspace(workspaceId: string): Promise<ValidationRule[]> {
    const db = await this.db();
    return db.getAllFromIndex('validationRules', 'workspaceId', workspaceId);
  }

  async listValidationRulesByCategory(workspaceId: string, category: string): Promise<ValidationRule[]> {
    const all = await this.listValidationRulesByWorkspace(workspaceId);
    return all.filter(r => r.category === category);
  }

  async putValidationRule(rule: ValidationRule): Promise<void> {
    await (await this.db()).put('validationRules', rule);
  }

  async deleteValidationRule(id: string): Promise<void> {
    await (await this.db()).delete('validationRules', id);
  }

  async deleteNormalizedByFile(sourceFileId: string): Promise<void> {
    const db = await this.db();
    const keys = await db.getAllKeysFromIndex('normalizedLotCompositions', 'sourceFileId', sourceFileId);
    if (!keys.length) return;
    const tx = db.transaction('normalizedLotCompositions', 'readwrite');
    keys.forEach(k => tx.store.delete(k));
    await tx.done;
  }

  // ── Housekeeping ────────────────────────────────────────────────────────────

  /**
   * Delete all data that belongs to a workspace WITHOUT deleting the workspace record itself.
   * Useful for "reset workspace" without losing the workspace shell.
   */
  async deleteWorkspaceData(workspaceId: string): Promise<void> {
    const [files, cls, prs, maps, staged, normalized] = await Promise.all([
      this.listRawFilesByWorkspace(workspaceId),
      this.listClassificationsByWorkspace(workspaceId),
      this.listParseResultsByWorkspace(workspaceId),
      this.listMappingsByWorkspace(workspaceId),
      this.listStagedByWorkspace(workspaceId),
      this.listNormalizedByWorkspace(workspaceId),
    ]);

    const rules = await this.listValidationRulesByWorkspace(workspaceId);

    const db = await this.db();
    const tx = db.transaction(
      ['rawFiles', 'classifications', 'parseResults', 'mappings', 'stagedRecords', 'normalizedLotCompositions', 'validationRules'],
      'readwrite',
    );
    files.forEach(f    => tx.objectStore('rawFiles').delete(f.id));
    cls.forEach(c      => tx.objectStore('classifications').delete(c.fileId));
    prs.forEach(p      => tx.objectStore('parseResults').delete(p.fileId));
    maps.forEach(m     => tx.objectStore('mappings').delete([m.workspaceId, m.category]));
    staged.forEach(s   => tx.objectStore('stagedRecords').delete(s.id));
    normalized.forEach(n => tx.objectStore('normalizedLotCompositions').delete(n.id));
    rules.forEach(r    => tx.objectStore('validationRules').delete(r.id));
    await tx.done;
  }

  async clearAll(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(
      ['workspaces', 'rawFiles', 'classifications', 'parseResults', 'mappings', 'stagedRecords', 'normalizedLotCompositions', 'validationRules'],
      'readwrite'
    );
    await Promise.all([
      tx.objectStore('workspaces').clear(),
      tx.objectStore('rawFiles').clear(),
      tx.objectStore('classifications').clear(),
      tx.objectStore('parseResults').clear(),
      tx.objectStore('mappings').clear(),
      tx.objectStore('stagedRecords').clear(),
      tx.objectStore('normalizedLotCompositions').clear(),
      tx.objectStore('validationRules').clear(),
    ]);
    await tx.done;
  }
}
