/**
 * SmartPlaylistBuilder.tsx
 * ─────────────────────────────────────────────────────────────
 * iTunes-style Smart Playlist rule builder.
 *
 * Users define rules with field/operator/value conditions.
 * The component previews matching tracks in real-time.
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { haptic } from '@/utils/haptics';

export interface SmartPlaylistRule {
  field: 'genre' | 'artist' | 'duration' | 'year' | 'playCount' | 'title';
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string;
}

const FIELD_OPTIONS = [
  { value: 'genre', label: 'Genre' },
  { value: 'artist', label: 'Artist' },
  { value: 'title', label: 'Title' },
  { value: 'duration', label: 'Duration (sec)' },
  { value: 'year', label: 'Year' },
  { value: 'playCount', label: 'Play Count' },
] as const;

const STRING_OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'contains', label: 'contains' },
] as const;

const NUMERIC_OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
] as const;

const NUMERIC_FIELDS = new Set(['duration', 'year', 'playCount']);

interface SmartPlaylistBuilderProps {
  onPreview: (rules: SmartPlaylistRule[]) => void;
  loading?: boolean;
}

export function SmartPlaylistBuilder({ onPreview, loading }: SmartPlaylistBuilderProps) {
  const [rules, setRules] = useState<SmartPlaylistRule[]>([
    { field: 'genre', operator: 'equals', value: '' },
  ]);

  const addRule = useCallback(() => {
    haptic();
    setRules((prev) => [...prev, { field: 'genre', operator: 'equals', value: '' }]);
  }, []);

  const removeRule = useCallback((index: number) => {
    haptic();
    setRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRule = useCallback(
    (index: number, updates: Partial<SmartPlaylistRule>) => {
      setRules((prev) =>
        prev.map((rule, i) => {
          if (i !== index) return rule;
          const updated = { ...rule, ...updates };
          // Reset operator when switching between string/numeric fields
          if (updates.field) {
            const wasNumeric = NUMERIC_FIELDS.has(rule.field);
            const isNumeric = NUMERIC_FIELDS.has(updates.field);
            if (wasNumeric !== isNumeric) {
              updated.operator = isNumeric ? 'gt' : 'equals';
              updated.value = '';
            }
          }
          return updated;
        }),
      );
    },
    [],
  );

  const handlePreview = useCallback(() => {
    haptic();
    const validRules = rules.filter((r) => r.value.trim() !== '');
    if (validRules.length > 0) {
      onPreview(validRules);
    }
  }, [rules, onPreview]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={16} className="text-[#fc3c44]" />
        <span className="text-[15px] font-semibold text-white">Smart Rules</span>
      </div>

      {rules.map((rule, index) => {
        const isNumeric = NUMERIC_FIELDS.has(rule.field);
        const operators = isNumeric ? NUMERIC_OPERATORS : STRING_OPERATORS;

        return (
          <div key={index} className="flex items-center gap-2">
            {/* Field selector */}
            <select
              value={rule.field}
              onChange={(e) => updateRule(index, { field: e.target.value as SmartPlaylistRule['field'] })}
              className="bg-white/[0.08] text-white text-[13px] rounded-lg px-2 py-1.5 border-0 outline-none min-w-[90px]"
            >
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Operator selector */}
            <select
              value={rule.operator}
              onChange={(e) => updateRule(index, { operator: e.target.value as SmartPlaylistRule['operator'] })}
              className="bg-white/[0.08] text-white text-[13px] rounded-lg px-2 py-1.5 border-0 outline-none min-w-[60px]"
            >
              {operators.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Value input */}
            <input
              type={isNumeric ? 'number' : 'text'}
              value={rule.value}
              onChange={(e) => updateRule(index, { value: e.target.value })}
              placeholder={isNumeric ? '0' : 'value'}
              className="flex-1 bg-white/[0.08] text-white text-[13px] rounded-lg px-2.5 py-1.5 border-0 outline-none placeholder:text-white/30 min-w-0"
            />

            {/* Remove button */}
            {rules.length > 1 && (
              <button
                onClick={() => removeRule(index)}
                className="text-white/30 active:text-red-400 p-1"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={addRule}
          className="flex items-center gap-1 text-[13px] text-[#fc3c44] font-medium active:opacity-70"
        >
          <Plus size={14} />
          Add Rule
        </button>

        <div className="flex-1" />

        <button
          onClick={handlePreview}
          disabled={loading}
          className="flex items-center gap-1.5 bg-[#fc3c44] text-white text-[13px] font-semibold rounded-full px-4 py-1.5 active:opacity-80 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Preview
        </button>
      </div>
    </div>
  );
}
