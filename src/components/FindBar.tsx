import type { RefObject } from "react";
import { useI18n } from "../I18nProvider";

interface FindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  current: number;
  total: number;
  error: string | null;
  caseSensitive: boolean;
  regex: boolean;
  onToggleCase: () => void;
  onToggleRegex: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function FindBar({
  query,
  onQueryChange,
  current,
  total,
  error,
  caseSensitive,
  regex,
  onToggleCase,
  onToggleRegex,
  onNext,
  onPrev,
  onClose,
  inputRef,
}: FindBarProps) {
  const { t } = useI18n();
  const countLabel =
    error === "invalid"
      ? t("findInvalidRegex")
      : query && total === 0
        ? t("findNoMatches")
        : query
          ? t("findMatchOf", { current: current + 1, total })
          : t("findMatchOf", { current: 0, total: 0 });

  return (
    <div className="find-bar" role="search">
      <label className="find-field">
        <span className="sr-only">{t("find")}</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={t("findPlaceholder")}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <span className={`find-count${query && (total === 0 || error) ? " is-empty" : ""}`} aria-live="polite">
        {countLabel}
      </span>
      <button
        type="button"
        className="find-icon"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onPrev}
        disabled={!total}
        title={t("findPrev")}
      >
        ↑
      </button>
      <button
        type="button"
        className="find-icon"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onNext}
        disabled={!total}
        title={t("findNext")}
      >
        ↓
      </button>
      <button
        type="button"
        className={`find-icon${caseSensitive ? " is-on" : ""}`}
        aria-pressed={caseSensitive}
        title={t("caseSensitive")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleCase}
      >
        Aa
      </button>
      <button
        type="button"
        className={`find-icon${regex ? " is-on" : ""}`}
        aria-pressed={regex}
        title={t("regex")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleRegex}
      >
        .*
      </button>
      <button
        type="button"
        className="find-icon"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
        title={t("findClose")}
      >
        ×
      </button>
    </div>
  );
}
