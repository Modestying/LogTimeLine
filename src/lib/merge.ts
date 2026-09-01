import type { MergeMode } from "../types";
import { eventTime, parseEvent, splitEntries } from "./parse";

interface TaggedLine {
  raw: string;
  time: number | null;
  order: number;
}

function tagLines(text: string, offset: number): TaggedLine[] {
  return splitEntries(text).map((raw, index) => {
    const event = parseEvent(raw, index);
    return { raw, time: eventTime(event), order: offset + index };
  });
}

export function mergeTexts(current: string, incoming: string, mode: MergeMode): string {
  const incomingTrimmed = incoming.trim();
  if (!incomingTrimmed) return current;
  if (!current.trim() || mode === "overwrite") return incomingTrimmed;
  if (mode === "append") {
    return `${current.replace(/\s*$/, "")}\n${incomingTrimmed}`;
  }

  const left = tagLines(current, 0);
  const right = tagLines(incoming, left.length);
  const mixed = [...left, ...right];
  mixed.sort((a, b) => {
    if (a.time != null && b.time != null && a.time !== b.time) return a.time - b.time;
    if (a.time != null && b.time == null) return -1;
    if (a.time == null && b.time != null) return 1;
    return a.order - b.order;
  });
  return mixed.map((line) => line.raw).join("\n");
}
