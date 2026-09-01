import { useCallback, useEffect, useMemo, useState } from "react";
import { Editor } from "./components/Editor";
import { ImportModal } from "./components/ImportModal";
import { Timeline } from "./components/Timeline";
import { useI18n } from "./I18nProvider";
import { mergeTexts } from "./lib/merge";
import { parseLogText } from "./lib/parse";
import { SAMPLE_LOG } from "./lib/sample";
import { APP_VERSION, checkForUpdate, type UpdateResult } from "./lib/updates";
import type { MergeMode } from "./types";

const STORAGE_KEY = "logtimeline:text";

type ModalKind = "import" | "filter" | null;
type Layout = "split" | "editor" | "timeline";

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [layout, setLayout] = useState<Layout>("split");
  const [update, setUpdate] = useState<UpdateResult | { status: "idle" } | { status: "checking" }>({
    status: "idle",
  });
  const [manualCheck, setManualCheck] = useState(false);

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

  const runUpdateCheck = useCallback(async (manual = false) => {
    if (manual) setManualCheck(true);
    setUpdate({ status: "checking" });
    const result = await checkForUpdate();
    setUpdate(result);
  }, []);

  useEffect(() => {
    void runUpdateCheck(false);
  }, [runUpdateCheck]);

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
            <p>{t("tagline")}</p>
          </div>
        </div>
        <div className="top-actions">
          <div className="lang-switch" role="group" aria-label={t("langLabel")}>
            <button
              type="button"
              className={locale === "zh" ? "is-on" : ""}
              onClick={() => setLocale("zh")}
            >
              {t("langZh")}
            </button>
            <button
              type="button"
              className={locale === "en" ? "is-on" : ""}
              onClick={() => setLocale("en")}
            >
              {t("langEn")}
            </button>
          </div>
          <span className="version-chip">{t("currentVersion", { version: APP_VERSION })}</span>
          <button
            type="button"
            className="btn ghost"
            onClick={() => void runUpdateCheck(true)}
            disabled={update.status === "checking"}
          >
            {update.status === "checking" ? t("checkingUpdate") : t("checkUpdate")}
          </button>
          <button type="button" className="btn primary" onClick={() => setModal("import")}>
            {t("import")}
          </button>
          <button type="button" className="btn ghost" onClick={() => setModal("filter")} disabled={!hasCurrent}>
            {t("filterCurrent")}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setText((prev) => mergeTexts(prev, SAMPLE_LOG, prev.trim() ? "timestamp" : "overwrite"));
            }}
          >
            {t("loadSample")}
          </button>
          <button type="button" className="btn ghost" onClick={exportText} disabled={!hasCurrent}>
            {t("export")}
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
            {t("clear")}
          </button>
        </div>
      </header>

      {(update.status === "available" ||
        (manualCheck && (update.status === "current" || update.status === "error"))) && (
        <div className={`update-bar status-${update.status}`}>
          {update.status === "current" && <span>{t("upToDate", { version: update.latest })}</span>}
          {update.status === "available" && (
            <>
              <span>{t("updateAvailable", { latest: update.latest })}</span>
              <a className="link-btn" href={update.url} target="_blank" rel="noreferrer">
                {t("openDownload")}
              </a>
            </>
          )}
          {update.status === "error" && <span>{t("updateFailed")}</span>}
        </div>
      )}

      <div className="layout-switch" role="tablist">
        {(
          [
            ["split", "split"],
            ["editor", "text"],
            ["timeline", "timeline"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={layout === id}
            className={layout === id ? "is-on" : ""}
            onClick={() => setLayout(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <main className={`workspace layout-${layout}`}>
        {(layout === "split" || layout === "editor") && (
          <section className="pane pane-editor">
            <div className="pane-head">
              <h2>{t("currentText")}</h2>
              <span className="muted">
                {text.trim() ? t("lines", { n: text.split("\n").length }) : t("empty")}
              </span>
            </div>
            <Editor
              value={text}
              onChange={setText}
              selectedLine={selectedLine}
              onSelectLine={setSelectedLine}
              placeholder={t("editorPlaceholder")}
            />
          </section>
        )}
        {(layout === "split" || layout === "timeline") && (
          <section className="pane pane-timeline">
            <div className="pane-head">
              <h2>{t("timeline")}</h2>
              <span className="muted">{t("datedEvents", { n: datedCount })}</span>
            </div>
            <Timeline events={events} selectedLine={selectedLine} onSelect={(event) => setSelectedLine(event.lineIndex)} />
          </section>
        )}
      </main>

      {modal === "import" && (
        <ImportModal kind="import" hasCurrent={hasCurrent} onClose={() => setModal(null)} onApply={applyIncoming} />
      )}
      {modal === "filter" && (
        <ImportModal
          kind="filter"
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
