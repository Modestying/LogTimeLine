import { useEffect, useMemo, useRef } from "react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  selectedLine: number | null;
  onSelectLine: (line: number) => void;
}

const LINE_HEIGHT = 22;

export function Editor({ value, onChange, selectedLine, onSelectLine }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = value.length === 0 ? 1 : value.split("\n").length;
  const numbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount],
  );

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta == null || selectedLine == null) return;
    const y = selectedLine * LINE_HEIGHT;
    const next = Math.max(0, y - ta.clientHeight / 3);
    ta.scrollTop = next;
    if (gutterRef.current) gutterRef.current.scrollTop = next;
  }, [selectedLine]);

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta || !gutterRef.current) return;
    gutterRef.current.scrollTop = ta.scrollTop;
  };

  const onClickGutter = (line: number) => {
    onSelectLine(line);
    textareaRef.current?.focus();
  };

  return (
    <div className="editor">
      <div className="editor-gutter" ref={gutterRef} aria-hidden>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className={`gutter-n${selectedLine === n - 1 ? " is-active" : ""}`}
            style={{ height: LINE_HEIGHT }}
            onClick={() => onClickGutter(n - 1)}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="editor-input"
        spellCheck={false}
        wrap="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onClick={(e) => {
          const ta = e.currentTarget;
          const line = ta.value.slice(0, ta.selectionStart).split("\n").length - 1;
          onSelectLine(line);
        }}
        placeholder="粘贴日志，或点击「导入」合并文本…"
        style={{ lineHeight: `${LINE_HEIGHT}px` }}
      />
    </div>
  );
}
