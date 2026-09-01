import { useCallback, useEffect, useMemo, useState } from "react";
import { Editor } from "./components/Editor";
import { ImportModal } from "./components/ImportModal";
import { Timeline } from "./components/Timeline";
import { mergeTexts } from "./lib/merge";
import { parseLogText } from "./lib/parse";
import { SAMPLE_LOG } from "./lib/sample";
import type { MergeMode } from "./types";

const STORAGE_KEY = "logtimeline:text";

type ModalKind = "import" | "filter" | null;
type Layout = "split" | "editor" | "timeline";

export default function App() {
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [layout, setLayout] = useState<Layout>("split");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, text);
  }, [text]);

  const events = useMemo(() => parseLogText(text), [text]);
  const hasCurrent = text.trim().length > 0;
  const datedCount = events.filter((e) => e.timestamp).length;

  const applyIncoming = useCallback(
    (incoming: string, mode: MergeMode) => {
      setText((prev) => mergeTexts(prev, incoming, mode));
      setSelectedLine(null);
      setModal(null);
    },
    [],
  );

  const exportText = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "merged-logs.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setModal("import");
      }
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden />
          <div>
            <h1>LogTimeLine</h1>
            <p>合并日志，筛选替换，按时间戳生成时序</p>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" className="btn primary" onClick={() => setModal("import")}>
            导入
          </button>
          <button type="button" className="btn ghost" onClick={() => setModal("filter")} disabled={!hasCurrent}>
            筛选当前
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setText((prev) => mergeTexts(prev, SAMPLE_LOG, prev.trim() ? "timestamp" : "overwrite"));
            }}
          >
            载入示例
          </button>
          <button type="button" className="btn ghost" onClick={exportText} disabled={!hasCurrent}>
            导出
          </button>
          <button
            type="button"
            className="btn ghost danger"
            onClick={() => {
              setText("");
              setSelectedLine(null);
            }}
            disabled={!hasCurrent}
          >
            清空
          </button>
        </div>
      </header>

      <div className="layout-switch" role="tablist">
        {(
          [
            ["split", "分栏"],
            ["editor", "文本"],
            ["timeline", "时序图"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={layout === id}
            className={layout === id ? "is-on" : ""}
            onClick={() => setLayout(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <main className={`workspace layout-${layout}`}>
        {(layout === "split" || layout === "editor") && (
          <section className="pane pane-editor">
            <div className="pane-head">
              <h2>当前文本</h2>
              <span className="muted">
                {text.trim() ? `${text.split("\n").length} 行` : "空"}
              </span>
            </div>
            <Editor
              value={text}
              onChange={setText}
              selectedLine={selectedLine}
              onSelectLine={setSelectedLine}
            />
          </section>
        )}
        {(layout === "split" || layout === "timeline") && (
          <section className="pane pane-timeline">
            <div className="pane-head">
              <h2>时序图</h2>
              <span className="muted">{datedCount} 个带时间戳的事件</span>
            </div>
            <Timeline
              events={events}
              selectedLine={selectedLine}
              onSelect={(event) => setSelectedLine(event.lineIndex)}
            />
          </section>
        )}
      </main>

      {modal === "import" && (
        <ImportModal hasCurrent={hasCurrent} onClose={() => setModal(null)} onApply={applyIncoming} />
      )}
      {modal === "filter" && (
        <ImportModal
          title="筛选 / 替换当前文本"
          confirmLabel="应用"
          initialText={text}
          hasCurrent={hasCurrent}
          showMerge={false}
          onClose={() => setModal(null)}
          onApply={(incoming) => applyIncoming(incoming, "overwrite")}
        />
      )}
    </div>
  );
}
