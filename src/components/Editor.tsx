import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { collectFindMatches, indexOfMatchAtOrAfter, type FindMatch } from "../lib/find";
import type { LineSelectionSource } from "../types";
import { FindBar } from "./FindBar";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  selectedLine: number | null;
  selectionSource: LineSelectionSource;
  onSelectLine: (line: number, source: LineSelectionSource) => void;
  placeholder: string;
  findOpen: boolean;
  findNonce: number;
  onCloseFind: () => void;
  syncOnScroll: boolean;
}

const LINE_HEIGHT = 22;
const MAX_VISIBLE_HITS = 200;

function editorFont(textarea: HTMLTextAreaElement): string {
  const cs = getComputedStyle(textarea);
  return `${cs.fontSize} ${cs.fontFamily}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measureWidth(font: string, value: string): number {
  if (!measureCtx) {
    const canvas = document.createElement("canvas");
    measureCtx = canvas.getContext("2d");
  }
  if (!measureCtx) return value.length * 7;
  measureCtx.font = font;
  return measureCtx.measureText(value).width;
}

export function Editor({
  value,
  onChange,
  selectedLine,
  selectionSource,
  onSelectLine,
  placeholder,
  findOpen,
  findNonce,
  onCloseFind,
  syncOnScroll,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const skipJumpRef = useRef(false);
  const ignoreScrollReportRef = useRef(false);
  const lastScrollLineRef = useRef<number | null>(null);
  const matchesRef = useRef<FindMatch[]>([]);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [active, setActive] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0, height: 0 });
  const [font, setFont] = useState("12px monospace");
  const [padLeft, setPadLeft] = useState(12);
  const lineCount = value.length === 0 ? 1 : value.split("\n").length;
  const lines = useMemo(() => value.split("\n"), [value]);
  const numbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1), [lineCount]);

  const { matches, error } = useMemo(
    () => collectFindMatches(value, query, { caseSensitive, regex }),
    [value, query, caseSensitive, regex],
  );
  const matchLines = useMemo(() => new Set(matches.map((m) => m.line)), [matches]);
  const currentMatch = matches[active] ?? null;
  matchesRef.current = matches;

  useEffect(() => {
    if (active >= matches.length) setActive(0);
  }, [active, matches.length]);

  useEffect(() => {
    if (!findOpen) return;
    const ta = textareaRef.current;
    if (ta && ta.selectionStart !== ta.selectionEnd) {
      const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (selected.length > 0 && selected.length <= 200 && !selected.includes("\n")) {
        setQuery(selected);
      }
    }
    const id = window.setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [findOpen, findNonce]);

  useEffect(() => {
    if (!findOpen || !query) return;
    const ta = textareaRef.current;
    const pos = ta?.selectionStart ?? 0;
    setActive(indexOfMatchAtOrAfter(matches, pos));
    // Re-anchor when the query/options change, not when cycling matches or editing text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findOpen, query, caseSensitive, regex]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setFont(editorFont(ta));
    setPadLeft(parseFloat(getComputedStyle(ta).paddingLeft) || 12);
    setScroll({ top: ta.scrollTop, left: ta.scrollLeft, height: ta.clientHeight });
  }, [findOpen, value]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta == null || selectedLine == null) return;
    if (selectionSource === "editor-click" || selectionSource === "editor-scroll") return;
    const y = selectedLine * LINE_HEIGHT;
    const next =
      selectionSource === "timeline-scroll"
        ? y
        : Math.max(0, y - ta.clientHeight / 3);
    ignoreScrollReportRef.current = true;
    lastScrollLineRef.current = selectedLine;
    ta.scrollTop = next;
    syncLayers(ta);
    const timer = window.setTimeout(() => {
      ignoreScrollReportRef.current = false;
    }, 80);
    return () => {
      window.clearTimeout(timer);
      ignoreScrollReportRef.current = false;
    };
  }, [selectedLine, selectionSource]);

  useEffect(() => {
    if (!findOpen || !currentMatch) return;
    if (skipJumpRef.current) {
      skipJumpRef.current = false;
      return;
    }
    const ta = textareaRef.current;
    if (!ta) return;
    const y = currentMatch.line * LINE_HEIGHT;
    const next = Math.max(0, y - ta.clientHeight / 3);
    if (y < ta.scrollTop || y + LINE_HEIGHT > ta.scrollTop + ta.clientHeight) {
      ta.scrollTop = next;
    }
    const start = Math.min(currentMatch.start, ta.value.length);
    const end = Math.min(currentMatch.end, ta.value.length);
    ta.setSelectionRange(start, end);
    onSelectLine(currentMatch.line, "find");
    syncLayers(ta);
  }, [findOpen, currentMatch, onSelectLine]);

  useEffect(() => {
    if (!findOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g")) {
        e.preventDefault();
        if (matchesRef.current.length === 0) return;
        if (e.shiftKey) setActive((i) => (i - 1 + matchesRef.current.length) % matchesRef.current.length);
        else setActive((i) => (i + 1) % matchesRef.current.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [findOpen]);

  const syncLayers = (ta: HTMLTextAreaElement) => {
    setScroll({ top: ta.scrollTop, left: ta.scrollLeft, height: ta.clientHeight });
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  const stepMatch = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    setActive((i) => (i + dir + matches.length) % matches.length);
  };

  useEffect(() => {
    lastScrollLineRef.current = null;
  }, [value]);

  const reportCaretLine = (ta: HTMLTextAreaElement, source: LineSelectionSource) => {
    const line = ta.value.slice(0, ta.selectionStart).split("\n").length - 1;
    lastScrollLineRef.current = line;
    onSelectLine(line, source);
  };

  const reportScrollLine = (ta: HTMLTextAreaElement) => {
    if (!syncOnScroll || ignoreScrollReportRef.current) return;
    const line = Math.max(0, Math.floor((ta.scrollTop + 4) / LINE_HEIGHT));
    if (line === lastScrollLineRef.current) return;
    lastScrollLineRef.current = line;
    onSelectLine(line, "editor-scroll");
  };

  const onClickGutter = (line: number) => {
    lastScrollLineRef.current = line;
    onSelectLine(line, "editor-click");
    textareaRef.current?.focus();
  };

  const visibleHits = useMemo(() => {
    if (!findOpen || matches.length === 0) return [];
    const viewStart = scroll.top;
    const viewEnd = scroll.top + scroll.height + LINE_HEIGHT;
    const out: FindMatch[] = [];
    for (const match of matches) {
      const y = match.line * LINE_HEIGHT;
      if (y + LINE_HEIGHT < viewStart) continue;
      if (y > viewEnd) break;
      out.push(match);
      if (out.length >= MAX_VISIBLE_HITS) break;
    }
    return out;
  }, [findOpen, matches, scroll.height, scroll.top]);

  return (
    <div className="editor-shell">
      {findOpen && (
        <FindBar
          query={query}
          onQueryChange={setQuery}
          current={matches.length === 0 ? 0 : active}
          total={matches.length}
          error={error}
          caseSensitive={caseSensitive}
          regex={regex}
          onToggleCase={() => setCaseSensitive((v) => !v)}
          onToggleRegex={() => setRegex((v) => !v)}
          onNext={() => stepMatch(1)}
          onPrev={() => stepMatch(-1)}
          onClose={onCloseFind}
          inputRef={findInputRef}
        />
      )}
      <div className="editor">
        <div className="editor-gutter" ref={gutterRef} aria-hidden>
          {numbers.map((n) => {
            const line = n - 1;
            const className = [
              "gutter-n",
              selectedLine === line ? "is-active" : "",
              findOpen && matchLines.has(line) ? "is-hit" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={n}
                type="button"
                className={className}
                style={{ height: LINE_HEIGHT }}
                onClick={() => onClickGutter(line)}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="editor-main">
          {findOpen && (
            <div className="editor-hits" aria-hidden>
              {visibleHits.map((match, i) => {
                const lineText = lines[match.line] ?? "";
                const spanLen = Math.min(match.end - match.start, lineText.length - match.column);
                const matchText = lineText.slice(match.column, match.column + Math.max(spanLen, 0));
                const left = padLeft + measureWidth(font, lineText.slice(0, match.column)) - scroll.left;
                const width = Math.max(measureWidth(font, matchText || " "), 4);
                const isCurrent =
                  currentMatch != null && match.start === currentMatch.start && match.end === currentMatch.end;
                return (
                  <span
                    key={`${match.start}-${i}`}
                    className={`find-hit${isCurrent ? " is-current" : ""}`}
                    style={{
                      top: match.line * LINE_HEIGHT - scroll.top,
                      left,
                      width,
                      height: LINE_HEIGHT,
                    }}
                  />
                );
              })}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="editor-input"
            spellCheck={false}
            wrap="off"
            value={value}
            onChange={(e) => {
              skipJumpRef.current = true;
              onChange(e.target.value);
            }}
            onScroll={(e) => {
              syncLayers(e.currentTarget);
              reportScrollLine(e.currentTarget);
            }}
            onClick={(e) => reportCaretLine(e.currentTarget, "editor-click")}
            onKeyUp={(e) => {
              if (
                e.key === "ArrowUp" ||
                e.key === "ArrowDown" ||
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                e.key === "Home" ||
                e.key === "End" ||
                e.key === "PageUp" ||
                e.key === "PageDown"
              ) {
                reportCaretLine(e.currentTarget, "editor-click");
              }
            }}
            placeholder={placeholder}
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          />
        </div>
      </div>
    </div>
  );
}
