export type LineSelectionSource = "editor-click" | "editor-scroll" | "timeline" | "timeline-scroll" | "find";

export interface LogEvent {
  id: string;
  lineIndex: number;
  raw: string;
  timestamp: Date | null;
  timestampRaw: string;
  level: string;
  caller: string;
  durationMs: number | null;
  summary: string;
  method: string;
  path: string;
  status: number | null;
  trace: string;
  span: string;
  host: string;
}

export interface FilterConfig {
  include: string;
  exclude: string;
  includeMode: "all" | "any";
  regex: boolean;
  caseSensitive: boolean;
}

export interface ReplaceRule {
  id: string;
  find: string;
  replace: string;
  regex: boolean;
}

export type MergeMode = "overwrite" | "append" | "timestamp";

export interface TransformResult {
  text: string;
  inputLines: number;
  keptLines: number;
  replacedLines: number;
  lines: string[];
  error: string | null;
}

export const emptyFilter = (): FilterConfig => ({
  include: "",
  exclude: "",
  includeMode: "any",
  regex: false,
  caseSensitive: false,
});

export const newReplaceRule = (): ReplaceRule => ({
  id: crypto.randomUUID(),
  find: "",
  replace: "",
  regex: false,
});
