import type { FilterConfig, ReplaceRule, TransformResult } from "../types";
import { splitEntries } from "./parse";

function compilePattern(
  pattern: string,
  regex: boolean,
  caseSensitive: boolean,
): { test: (line: string) => boolean; error: string | null } {
  const trimmed = pattern.trim();
  if (!trimmed) return { test: () => true, error: null };
  if (regex) {
    try {
      const flags = caseSensitive ? "" : "i";
      const re = new RegExp(trimmed, flags);
      return { test: (line) => re.test(line), error: null };
    } catch (err) {
      return { test: () => false, error: err instanceof Error ? err.message : "无效正则" };
    }
  }
  const needle = caseSensitive ? trimmed : trimmed.toLowerCase();
  return {
    test: (line) => (caseSensitive ? line : line.toLowerCase()).includes(needle),
    error: null,
  };
}

function patternLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function matchesFilter(line: string, filter: FilterConfig): { keep: boolean; error: string | null } {
  const includePatterns = patternLines(filter.include);
  const excludePatterns = patternLines(filter.exclude);

  if (includePatterns.length > 0) {
    const testers = includePatterns.map((p) => compilePattern(p, filter.regex, filter.caseSensitive));
    const failed = testers.find((t) => t.error);
    if (failed) return { keep: false, error: failed.error };
    const hits = testers.map((t) => t.test(line));
    const includeOk = filter.includeMode === "all" ? hits.every(Boolean) : hits.some(Boolean);
    if (!includeOk) return { keep: false, error: null };
  }

  for (const pattern of excludePatterns) {
    const tester = compilePattern(pattern, filter.regex, filter.caseSensitive);
    if (tester.error) return { keep: false, error: tester.error };
    if (tester.test(line)) return { keep: false, error: null };
  }

  return { keep: true, error: null };
}

function applyRules(line: string, rules: ReplaceRule[]): { line: string; replaced: boolean; error: string | null } {
  let next = line;
  let replaced = false;
  for (const rule of rules) {
    if (!rule.find) continue;
    if (rule.regex) {
      try {
        const re = new RegExp(rule.find, "g");
        const updated = next.replace(re, rule.replace);
        if (updated !== next) replaced = true;
        next = updated;
      } catch (err) {
        return { line, replaced: false, error: err instanceof Error ? err.message : "无效替换正则" };
      }
    } else {
      if (next.includes(rule.find)) {
        next = next.split(rule.find).join(rule.replace);
        replaced = true;
      }
    }
  }
  return { line: next, replaced, error: null };
}

export function transformText(
  text: string,
  filter: FilterConfig,
  rules: ReplaceRule[],
): TransformResult {
  const input = splitEntries(text);
  const kept: string[] = [];
  let replacedLines = 0;

  for (const line of input) {
    const filtered = matchesFilter(line, filter);
    if (filtered.error) {
      return {
        text: "",
        inputLines: input.length,
        keptLines: 0,
        replacedLines: 0,
        lines: [],
        error: filtered.error,
      };
    }
    if (!filtered.keep) continue;
    const applied = applyRules(line, rules);
    if (applied.error) {
      return {
        text: "",
        inputLines: input.length,
        keptLines: 0,
        replacedLines: 0,
        lines: [],
        error: applied.error,
      };
    }
    if (applied.replaced) replacedLines++;
    kept.push(applied.line);
  }

  return {
    text: kept.join("\n"),
    inputLines: input.length,
    keptLines: kept.length,
    replacedLines,
    lines: kept,
    error: null,
  };
}
