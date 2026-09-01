import { useMemo, useRef, useState } from "react";
import type { FilterConfig, MergeMode, ReplaceRule } from "../types";
import { emptyFilter, newReplaceRule } from "../types";
import { transformText } from "../lib/transform";

interface ImportModalProps {
  initialText?: string;
  title?: string;
  confirmLabel?: string;
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
  initialText = "",
  title = "导入文本",
  confirmLabel = "导入",
  hasCurrent,
  showMerge = true,
  onClose,
  onApply,
}: ImportModalProps) {
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
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="modal-grid">
          <section className="modal-col">
            <div className="field-label">
              源文本
              {fileNames.length > 0 && <span className="muted"> · {fileNames.join("、")}</span>}
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
              <p>拖入文件，或粘贴到下方</p>
              <button type="button" className="btn ghost" onClick={() => inputRef.current?.click()}>
                选择文件
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
            <div className="field-label">筛选行</div>
            <div className="filter-row">
              <label>
                保留包含
                <textarea
                  rows={3}
                  value={filter.include}
                  onChange={(e) => setFilter((f) => ({ ...f, include: e.target.value }))}
                  placeholder={"每行一条，留空则全部保留\n例如: /v1/api/order/pay"}
                />
              </label>
              <label>
                排除包含
                <textarea
                  rows={3}
                  value={filter.exclude}
                  onChange={(e) => setFilter((f) => ({ ...f, exclude: e.target.value }))}
                  placeholder={"例如: kube-probe"}
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
                正则
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filter.caseSensitive}
                  onChange={(e) => setFilter((f) => ({ ...f, caseSensitive: e.target.checked }))}
                />
                区分大小写
              </label>
              <label>
                多条件
                <select
                  value={filter.includeMode}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, includeMode: e.target.value as "all" | "any" }))
                  }
                >
                  <option value="any">满足任一</option>
                  <option value="all">同时满足</option>
                </select>
              </label>
            </div>

            <div className="field-label">
              替换
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
                插入脱敏规则
              </button>
            </div>
            <div className="rules">
              {rules.map((rule) => (
                <div className="rule-row" key={rule.id}>
                  <input
                    value={rule.find}
                    onChange={(e) => updateRule(rule.id, { find: e.target.value })}
                    placeholder="查找"
                  />
                  <span className="arrow">→</span>
                  <input
                    value={rule.replace}
                    onChange={(e) => updateRule(rule.id, { replace: e.target.value })}
                    placeholder="替换为"
                  />
                  <label className="tiny">
                    <input
                      type="checkbox"
                      checked={rule.regex}
                      onChange={(e) => updateRule(rule.id, { regex: e.target.checked })}
                    />
                    正则
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                    aria-label="删除规则"
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
                添加替换
              </button>
            </div>
          </section>
        </div>

        <section className="preview-block">
          <div className="field-label">
            预览
            <span className={result.error ? "error-text" : "muted"}>
              {result.error
                ? result.error
                : ` 读入 ${result.inputLines} 行 → 保留 ${result.keptLines} 行${
                    result.replacedLines ? ` · 替换 ${result.replacedLines} 行` : ""
                  }`}
            </span>
          </div>
          <pre className="preview">{preview.join("\n") || "（无匹配行）"}</pre>
        </section>

        <footer className="modal-foot">
          {showMerge ? (
            <div className="merge-modes" role="radiogroup" aria-label="合并方式">
              <label>
                <input
                  type="radio"
                  name="merge-mode"
                  checked={mode === "overwrite"}
                  onChange={() => setMode("overwrite")}
                />
                覆盖当前
              </label>
              <label>
                <input
                  type="radio"
                  name="merge-mode"
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                  disabled={!hasCurrent}
                />
                追加到末尾
              </label>
              <label>
                <input
                  type="radio"
                  name="merge-mode"
                  checked={mode === "timestamp"}
                  onChange={() => setMode("timestamp")}
                  disabled={!hasCurrent}
                />
                按时间戳交错
              </label>
            </div>
          ) : (
            <span className="muted">将用筛选结果替换当前文本</span>
          )}
          <div className="foot-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              取消
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
