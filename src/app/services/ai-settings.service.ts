import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'migration-poc:ai-settings';
const DEFAULT_MODEL = 'claude-opus-4-8';

/** Models offered in Settings. Default is the most capable. */
export const AI_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (most capable)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest)' },
];

interface PersistedSettings {
  apiKey: string;
  model: string;
}

/**
 * App-level AI settings, persisted to localStorage. This is the first app-level
 * (non-workspace) setting store. The API key lives in the browser — acceptable
 * for a local single-user PoC only.
 */
@Injectable({ providedIn: 'root' })
export class AiSettingsService {
  private _apiKey = signal<string>('');
  private _model = signal<string>(DEFAULT_MODEL);

  readonly apiKey = this._apiKey.asReadonly();
  readonly model = this._model.asReadonly();
  readonly hasKey = computed(() => this._apiKey().trim().length > 0);

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
        if (typeof parsed.apiKey === 'string') this._apiKey.set(parsed.apiKey);
        if (typeof parsed.model === 'string' && parsed.model) this._model.set(parsed.model);
      }
    } catch {
      /* ignore malformed storage */
    }
  }

  setApiKey(key: string): void {
    this._apiKey.set(key.trim());
    this.persist();
  }

  setModel(model: string): void {
    this._model.set(model);
    this.persist();
  }

  private persist(): void {
    const payload: PersistedSettings = { apiKey: this._apiKey(), model: this._model() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}
