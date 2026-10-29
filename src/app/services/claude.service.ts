import { Injectable, inject } from '@angular/core';
import Anthropic from '@anthropic-ai/sdk';
import { Category, TargetSchemaField } from '../models';
import { AiSettingsService } from './ai-settings.service';
import {
  buildMappingSchema, buildCleanupSchema, coerceMappingSuggestion,
  CleanupRowProposal,
} from './claude.util';

export interface SuggestMappingInput {
  category: Category;
  targetFields: TargetSchemaField[];
  sourceColumns: string[];
  sampleRows: Record<string, unknown>[];
}

export interface CleanupInput {
  category: Category;
  targetFields: TargetSchemaField[];
  /** Records to clean: id + current data values. */
  records: { id: string; data: Record<string, unknown> }[];
}

/** Human-friendly message for a thrown SDK/network error. */
export function describeClaudeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Invalid API key — check it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Your API key lacks access to this model.';
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited by Anthropic — wait a moment and retry.';
  if (err instanceof Anthropic.APIConnectionError) return 'Network error reaching Anthropic.';
  if (err instanceof Anthropic.APIError) return `Claude API error: ${err.message}`;
  return `Claude request failed: ${err instanceof Error ? err.message : String(err)}`;
}

@Injectable({ providedIn: 'root' })
export class ClaudeService {
  private settings = inject(AiSettingsService);

  /** Build a fresh client per call so key/model changes are always picked up. */
  private client(): Anthropic {
    const apiKey = this.settings.apiKey();
    if (!apiKey) throw new Error('No API key set — add your Claude API key in Settings.');
    return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  /** Cheap round-trip to validate the key/model (used by Settings). */
  async testConnection(): Promise<void> {
    await this.client().messages.create({
      model: this.settings.model(),
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    });
  }

  /** Propose a target→source column mapping. Returns only validated pairs. */
  async suggestMapping(input: SuggestMappingInput): Promise<Record<string, string>> {
    const targetKeys = input.targetFields.map(f => f.key);
    const schema = buildMappingSchema(targetKeys, input.sourceColumns);

    const fieldLines = input.targetFields
      .map(f => `- ${f.key} (${f.label}, ${f.type}${f.required ? ', required' : ''})`)
      .join('\n');
    const prompt =
      `You are mapping columns of a source spreadsheet to a target schema for a ` +
      `winery data migration (category: ${input.category}).\n\n` +
      `TARGET FIELDS:\n${fieldLines}\n\n` +
      `SOURCE COLUMNS: ${JSON.stringify(input.sourceColumns)}\n\n` +
      `SAMPLE ROWS (up to 20):\n${JSON.stringify(input.sampleRows.slice(0, 20), null, 2)}\n\n` +
      `For each target field, choose the single best-matching source column, or "" ` +
      `if none fits. Use the sample values, not just header names, to decide.`;

    const message = await this.client().messages.create({
      model: this.settings.model(),
      max_tokens: 1024,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = parseJsonContent(message.content);
    return coerceMappingSuggestion(raw, targetKeys, input.sourceColumns);
  }

  /** Propose cleaned values for a batch of records. Streamed (output may be large). */
  async cleanupRecords(input: CleanupInput): Promise<CleanupRowProposal[]> {
    const fieldKeys = input.targetFields.map(f => f.key);
    const schema = buildCleanupSchema(fieldKeys);

    const fieldLines = input.targetFields
      .map(f => `- ${f.key} (${f.label}, ${f.type}${f.required ? ', required' : ''})`)
      .join('\n');
    const rows = input.records.map(r => ({ rowId: r.id, data: r.data }));
    const prompt =
      `You are cleaning transformed winery records (category: ${input.category}) so ` +
      `each value matches its target field's type and conventions.\n\n` +
      `TARGET FIELDS:\n${fieldLines}\n\n` +
      `RULES:\n` +
      `- number fields: digits only, no units/commas/currency (e.g. "5,000 L" -> "5000").\n` +
      `- date fields: ISO format YYYY-MM-DD.\n` +
      `- string fields: fix obvious abbreviations/casing/typos (e.g. "cab sauv" -> "Cabernet Sauvignon"); keep meaning.\n` +
      `- If a value is already clean, set changed=false and echo the value.\n` +
      `- Never invent data for empty/null values; leave them unchanged (changed=false, value="").\n\n` +
      `RECORDS:\n${JSON.stringify(rows, null, 2)}\n\n` +
      `Return one entry per rowId, with every target field present.`;

    const message = await this.client().messages
      .stream({
        model: this.settings.model(),
        max_tokens: 16000,
        output_config: { format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content: prompt }],
      })
      .finalMessage();

    const raw = parseJsonContent(message.content) as { rows?: unknown };
    const list = Array.isArray(raw?.rows) ? raw.rows : [];
    return list.filter(isCleanupRow);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract and JSON-parse the first text block of a message. */
function parseJsonContent(content: Anthropic.ContentBlock[]): unknown {
  const text = content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no text content');
  return JSON.parse(text);
}

function isCleanupRow(v: unknown): v is CleanupRowProposal {
  return !!v && typeof v === 'object'
    && typeof (v as CleanupRowProposal).rowId === 'string'
    && !!(v as CleanupRowProposal).fields && typeof (v as CleanupRowProposal).fields === 'object';
}
