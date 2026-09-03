import type { LogEvent } from "../types";

const TS_KEYS = ["@timestamp", "timestamp", "time", "ts", "datetime", "@time", "Time"];
const LEVEL_KEYS = ["level", "lvl", "severity", "log.level"];
const CALLER_KEYS = ["caller", "caller_file", "source", "logger"];
const TRACE_KEYS = ["trace", "traceId", "trace_id", "traceID"];
const SPAN_KEYS = ["span", "spanId", "span_id", "spanID"];

const ISO_RE =
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;
const HTTP_RE = /\[HTTP\]\s+(\d{3})\s+-\s+([A-Z]+)\s+(\S+)/;
const DURATION_RE = /(\d+(?:\.\d+)?)\s*(ms|s|µs|us|μs)/i;
const LEVEL_RE = /\b(trace|debug|info|warn|warning|error|fatal|panic)\b/i;

function strField(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function parseDurationMs(raw: string): number | null {
  const match = raw.match(DURATION_RE);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "s") return n * 1000;
  if (unit === "us" || unit === "µs" || unit === "μs") return n / 1000;
  return n;
}

function parseDate(raw: string): Date | null {
  const normalized = raw.replace(",", ".");
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    const ms = asNum > 1e12 ? asNum : asNum * 1000;
    const fromNum = new Date(ms);
    if (!Number.isNaN(fromNum.getTime())) return fromNum;
  }
  return null;
}

function extractJsonObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

function looksLikeNdjson(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return false;
  const sample = lines.slice(0, 12);
  let ok = 0;
  for (const line of sample) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object") ok++;
    } catch {
      /* ignore */
    }
  }
  return ok >= Math.min(2, sample.length) && ok / sample.length >= 0.5;
}

export function splitEntries(text: string): string[] {
  const trimmed = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!trimmed.trim()) return [];

  const body = trimmed.trim();
  if (body.startsWith("[")) {
    try {
      const arr = JSON.parse(body) as unknown;
      if (Array.isArray(arr)) {
        return arr.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
      }
    } catch {
      /* fall through */
    }
  }

  if (looksLikeNdjson(trimmed)) {
    return trimmed.split("\n").filter((line) => line.trim() !== "");
  }

  if (body.startsWith("{")) {
    const objects = extractJsonObjects(body);
    if (objects.length > 1) return objects;
    if (objects.length === 1 && body === objects[0]) return objects;
  }

  return trimmed.split("\n").filter((line) => line.trim() !== "");
}

function firstContentLine(content: string): string {
  return content.split(/\r?\n/)[0]?.trim() ?? "";
}

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* plain text */
  }
  return null;
}

export function parseEvent(raw: string, lineIndex: number): LogEvent {
  const obj = parseObject(raw);
  const durationField = strField(obj, ["duration", "latency", "elapsed"]);
  const content = strField(obj, ["content", "msg", "message", "msg_text"]);
  const haystack = [content, raw].join("\n");

  const timestampRaw =
    strField(obj, TS_KEYS) || haystack.match(ISO_RE)?.[0] || "";
  const http = haystack.match(HTTP_RE);
  const durationMs = parseDurationMs(durationField || haystack);
  const level =
    strField(obj, LEVEL_KEYS) || haystack.match(LEVEL_RE)?.[1]?.toLowerCase() || "";

  const summary = http
    ? `${http[2]} ${http[3]}`
    : firstContentLine(content) || raw.slice(0, 180);

  return {
    id: `${lineIndex}-${timestampRaw || raw.slice(0, 24)}`,
    lineIndex,
    raw,
    timestamp: timestampRaw ? parseDate(timestampRaw) : null,
    timestampRaw,
    level: level.toLowerCase() === "warning" ? "warn" : level.toLowerCase(),
    caller: strField(obj, CALLER_KEYS),
    durationMs,
    summary,
    method: http?.[2] ?? "",
    path: http?.[3] ?? "",
    status: http ? Number(http[1]) : null,
    trace: strField(obj, TRACE_KEYS),
    span: strField(obj, SPAN_KEYS),
    host: strField(obj, ["host", "Host"]) || haystack.match(/\bHost:\s*(\S+)/i)?.[1] || "",
  };
}

export function parseLogText(text: string): LogEvent[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) return [];

  const body = normalized.trim();
  if (body.startsWith("[")) {
    try {
      const arr = JSON.parse(body) as unknown;
      if (Array.isArray(arr)) {
        return arr.map((item, index) =>
          parseEvent(typeof item === "string" ? item : JSON.stringify(item), index),
        );
      }
    } catch {
      /* fall through */
    }
  }

  return normalized.split("\n").flatMap((raw, index) => {
    if (!raw.trim()) return [];
    return [parseEvent(raw, index)];
  });
}

export function nearestDatedEvent(events: LogEvent[], line: number): LogEvent | null {
  let atOrAfter: LogEvent | null = null;
  let lastBefore: LogEvent | null = null;
  for (const event of events) {
    if (!event.timestamp) continue;
    if (event.lineIndex === line) return event;
    if (event.lineIndex >= line) {
      if (!atOrAfter || event.lineIndex < atOrAfter.lineIndex) atOrAfter = event;
    } else if (!lastBefore || event.lineIndex > lastBefore.lineIndex) {
      lastBefore = event;
    }
  }
  return atOrAfter ?? lastBefore;
}

export function eventTime(event: LogEvent): number | null {
  return event.timestamp ? event.timestamp.getTime() : null;
}

export function formatClock(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function formatDelta(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 1000) return `${Math.round(ms)}ms`;
  if (abs < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(2)}m`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Number(ms.toFixed(1))}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
