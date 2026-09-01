import { useMemo } from "react";
import { useI18n } from "../I18nProvider";
import type { LogEvent } from "../types";
import { eventTime, formatClock, formatDelta, formatDuration } from "../lib/parse";

interface TimelineProps {
  events: LogEvent[];
  selectedLine: number | null;
  onSelect: (event: LogEvent) => void;
}

function statusTone(status: number | null, level: string): string {
  if (status != null) {
    if (status >= 500) return "error";
    if (status >= 400) return "warn";
    if (status >= 300) return "debug";
    if (status >= 200) return "ok";
  }
  if (level === "error" || level === "fatal" || level === "panic") return "error";
  if (level === "warn") return "warn";
  if (level === "info") return "ok";
  return "debug";
}

function hashHue(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function Timeline({ events, selectedLine, onSelect }: TimelineProps) {
  const { t } = useI18n();
  const dated = useMemo(
    () =>
      [...events]
        .filter((e) => e.timestamp)
        .sort((a, b) => (eventTime(a) ?? 0) - (eventTime(b) ?? 0)),
    [events],
  );
  const undated = useMemo(() => events.filter((e) => !e.timestamp), [events]);
  const maxDuration = Math.max(1, ...dated.map((e) => e.durationMs ?? 0));
  const t0 = dated[0]?.timestamp?.getTime() ?? 0;
  const t1 = dated[dated.length - 1]?.timestamp?.getTime() ?? t0;
  const levels = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of dated) {
      const key = e.level || "other";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [dated]);

  if (events.length === 0) {
    return (
      <div className="timeline-empty">
        <p>{t("timelineEmpty")}</p>
        <p className="muted">{t("timelineEmptyHint")}</p>
      </div>
    );
  }

  if (dated.length === 0) {
    return (
      <div className="timeline-empty">
        <p>{t("noTimestamp", { n: events.length })}</p>
        <p className="muted">{t("noTimestampHint")}</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      <header className="timeline-head">
        <div>
          <strong>
            {formatClock(dated[0].timestamp!)} → {formatClock(dated[dated.length - 1].timestamp!)}
          </strong>
          <span className="muted">
            {" "}
            · {t("eventCount", { n: dated.length })} · {t("span", { delta: formatDelta(t1 - t0) })}
          </span>
        </div>
        <div className="level-pills">
          {Object.entries(levels).map(([level, n]) => (
            <span key={level} className={`pill tone-${statusTone(null, level)}`}>
              {level} {n}
            </span>
          ))}
        </div>
      </header>
      <ol className="timeline-list">
        {dated.map((event, index) => {
          const prev = dated[index - 1];
          const delta = prev?.timestamp && event.timestamp
            ? event.timestamp.getTime() - prev.timestamp.getTime()
            : null;
          const tone = statusTone(event.status, event.level);
          const hue = event.trace ? hashHue(event.trace) : null;
          const width = event.durationMs != null ? Math.max(6, (event.durationMs / maxDuration) * 100) : 0;
          return (
            <li key={event.id}>
              <button
                type="button"
                className={`tl-item${selectedLine === event.lineIndex ? " is-active" : ""}`}
                onClick={() => onSelect(event)}
              >
                <div className="tl-rail">
                  <span className={`tl-dot tone-${tone}`} />
                </div>
                <div
                  className="tl-card"
                  style={hue == null ? undefined : { borderLeftColor: `hsl(${hue} 42% 48%)` }}
                >
                  <div className="tl-meta">
                    <time>{formatClock(event.timestamp!)}</time>
                    {delta != null && <span className="delta">+{formatDelta(delta)}</span>}
                    {event.level && <span className={`pill tone-${tone}`}>{event.level}</span>}
                    {event.status != null && <span className={`pill tone-${tone}`}>{event.status}</span>}
                    {event.durationMs != null && (
                      <span className="muted">{formatDuration(event.durationMs)}</span>
                    )}
                  </div>
                  <div className="tl-summary">
                    {event.method && <span className="method">{event.method}</span>}
                    <span className="path">{event.path || event.summary}</span>
                  </div>
                  <div className="tl-sub">
                    {event.caller && <span>{event.caller}</span>}
                    {event.trace && <span className="mono">trace {event.trace.slice(0, 12)}</span>}
                  </div>
                  {event.durationMs != null && (
                    <div className="dur-track" aria-hidden>
                      <span className={`dur-bar tone-${tone}`} style={{ width: `${width}%` }} />
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      {undated.length > 0 && (
        <p className="muted undated-note">{t("undated", { n: undated.length })}</p>
      )}
    </div>
  );
}
