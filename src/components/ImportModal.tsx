import { useMemo, useRef, useState } from "react";
import { useI18n } from "../I18nProvider";
import type { FilterConfig, MergeMode, ReplaceRule } from "../types";
import { emptyFilter, newReplaceRule } from "../types";
import { transformText } from "../lib/transform";

interface ImportModalProps {
  kind?: "import" | "filter";
  initialText?: string;
  hasCurrent: boolean;
  showMerge?: boolean;
  onClose: () => void;
  onApply: (text: string, mode: MergeMode) => void;
}

const REDACT_RULES: Omit<ReplaceRule, "id">[] = [
  { find: "oauth_token=[^&]*", replace: "oauth_token=***", regex: true },
  { find: "oauth_token_secret=[^&]*", replace: "oauth_token_secret=***", regex: true },
  { find: "access_token=[^&]*", replace: "access_token=***", regex: true },
  { find: "phone=\\d+", replace: "phone=***", regex: true },
];

export function ImportModal({
  kind = "import",
  initialText = "",
  hasCurrent,
  showMerge = true,
  onClose,
  onApply,
}: ImportModalProps) {
  const { locale, t } = useI18n();
  const [source, setSource] = useState(initialText);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterConfig>(emptyFilter);
  const [rules, setRules] = useState<ReplaceRule[]>([]);
  const [mode, setMode] = useState<MergeMode>(hasCurrent ? "timestamp" : "overwrite");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => transformText(source, filter, rules), [source, filter, rules]);
  const preview = result.lines.slice(0, 40);

  const readFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const texts = await Promise.all(list.map((file) => file.text()));
    const joined = texts.filter(Boolean).join("\n");
    setSource((prev) => (prev.trim() ? `${prev.replace(/\s*$/, "")}\n${joined}` : joined));
    setFileNames((prev) => [...prev, ...list.map((f) => f.name)]);
  };

  const updateRule = (id: string, patch: Partial<ReplaceRule>) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const canApply = result.keptLines > 0 && !result.error;
  const nameSep = locale === "zh" ? "、" : ", ";
  const title = kind === "filter" ? t("filterTitle") : t("importTitle");
  const confirmLabel = kind === "filter" ? t("apply") : t("importConfirm");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="import-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </header>

        <div className="modal-grid">
          <section className="modal-col">
            <div className="field-label">
              {t("sourceText")}
              {fileNames.length > 0 && <span className="muted"> · {fileNames.join(nameSep)}</span>}
            </div>
            <div
              className={`dropzone${dragging ? " is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) void readFiles(e.dataTransfer.files);
              }}
            >
              <p>{t("dropHint")}</p>
              <button type="button" className="btn ghost" onClick={() => inputRef.current?.click()}>
                {t("chooseFiles")}
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void readFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <textarea
              className="source-input"
              spellCheck={false}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder='{"@timestamp":"...","level":"error",...}'
            />
          </section>

          <section className="modal-col">
            <div className="field-label">{t("filterLines")}</div>
            <div className="filter-row">
              <label>
                {t("include")}
                <textarea
                  rows={3}
                  value={filter.include}
                  onChange={(e) => setFilter((f) => ({ ...f, include: e.target.value }))}
                  placeholder={t("includePlaceholder")}
                />
              </label>
              <label>
                {t("exclude")}
                <textarea
                  rows={3}
                  value={filter.exclude}
                  onChange={(e) => setFilter((f) => ({ ...f, exclude: e.target.value }))}
                  placeholder={t("excludePlaceholder")}
                />
              </label>
            </div>
            <div className="filter-opts">
              <label>
                <input
                  type="checkbox"
                  checked={filter.regex}
                  onChange={(e) => setFilter((f) => ({ ...f, regex: e.target.checked }))}
                />
                {t("regex")}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filter.caseSensitive}
                  onChange={(e) => setFilter((f) => ({ ...f, caseSensitive: e.target.checked }))}
                />
                {t("caseSensitive")}
              </label>
              <label>
                {t("multiCondition")}
                <select
                  value={filter.includeMode}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, includeMode: e.target.value as "all" | "any" }))
                  }
                >
                  <option value="any">{t("matchAny")}</option>
                  <option value="all">{t("matchAll")}</option>
                </select>
              </label>
            </div>

            <div className="field-label">
              {t("replace")}
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  setRules((prev) => [
                    ...prev,
                    ...REDACT_RULES.map((rule) => ({ ...rule, id: crypto.randomUUID() })),
                  ])
                }
              >
                {t("insertRedact")}
              </button>
            </div>
            <div className="rules">
              {rules.map((rule) => (
                <div className="rule-row" key={rule.id}>
                  <input
                    value={rule.find}
                    onChange={(e) => updateRule(rule.id, { find: e.target.value })}
                    placeholder={t("find")}
                  />
                  <span className="arrow">→</span>
                  <input
                    value={rule.replace}
                    onChange={(e) => updateRule(rule.id, { replace: e.target.value })}
                    placeholder={t("replaceWith")}
                  />
                  <label className="tiny">
                    <input
                      type="checkbox"
                      checked={rule.regex}
                      onChange={(e) => updateRule(rule.id, { regex: e.target.checked })}
                    />
                    {t("regex")}
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                    aria-label={t("deleteRule")}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn ghost"
                onClick={() => setRules((prev) => [...prev, newReplaceRule()])}
              >
                {t("addReplace")}
              </button>
            </div>
          </section>
        </div>

        <section className="preview-block">
          <div className="field-label">
            {t("preview")}
            <span className={result.error ? "error-text" : "muted"}>
              {result.error
                ? result.error
                : ` ${t("previewStats", { input: result.inputLines, kept: result.keptLines })}${
                    result.replacedLines ? t("previewReplaced", { n: result.replacedLines }) : ""
                  }`}
            </span>
          </div>
          <pre className="preview">{preview.join("\n") || t("noMatch")}</pre>
        </section>

        <footer className="modal-foot">
          {showMerge ? (
            <div className="merge-modes" role="radiogroup" aria-label={t("mergeMode")}>
              <label>
                <input
                  type="radio"
                  name="merge-mode"
                  checked={mode === "overwrite"}
                  onChange={() => setMode("overwrite")}
                />
                {t("overwrite")}
              </label>
              <label>
                <input
                  type="radio"
                  name="merge-mode"
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                  disabled={!hasCurrent}
                />
                {t("append")}
              </label>
              <label>
                <input
                  type="radio"
                  name="merge-mode"
                  checked={mode === "timestamp"}
                  onChange={() => setMode("timestamp")}
                  disabled={!hasCurrent}
                />
                {t("byTimestamp")}
              </label>
            </div>
          ) : (
            <span className="muted">{t("replaceCurrentHint")}</span>
          )}
          <div className="foot-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!canApply}
              onClick={() => onApply(result.text, mode)}
            >
              {confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
