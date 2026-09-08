"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyTag,
  formatCount,
  loadTagDb,
  searchTags,
  type TagEntry,
  tokenStart,
} from "@/lib/imagie/tagdb";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 120;

// A prompt input with danbooru tag autocomplete for the token under the
// caret. Suggestions render as a horizontal chip strip under the field.
export function TagField({
  value,
  onChange,
  placeholder,
  multiline,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [items, setItems] = useState<TagEntry[]>([]);
  const runId = useRef(0);

  const syncCaret = useCallback(() => {
    const el = ref.current;
    if (el) {
      setCaret(el.selectionStart ?? el.value.length);
    }
  }, []);

  useEffect(() => {
    const token = value.slice(tokenStart(value, caret), caret).trimStart();
    if (token.length < MIN_QUERY) {
      setItems([]);
      return;
    }
    runId.current += 1;
    const id = runId.current;
    const timer = setTimeout(async () => {
      const tags = await loadTagDb();
      if (!tags || runId.current !== id) {
        return;
      }
      setItems(searchTags(tags, token));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, caret]);

  const pick = useCallback(
    (entry: TagEntry) => {
      const res = applyTag(value, caret, entry);
      onChange(res.text);
      setItems([]);
      // restore caret after React re-renders the field
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) {
          el.focus();
          el.setSelectionRange(res.caret, res.caret);
          setCaret(res.caret);
        }
      });
    },
    [value, caret, onChange]
  );

  const common = {
    className,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      onChange(e.target.value);
      setCaret(e.target.selectionStart ?? e.target.value.length);
    },
    onClick: syncCaret,
    onKeyUp: syncCaret,
    placeholder,
    value,
  };

  return (
    <div className="flex flex-col gap-1">
      {multiline ? (
        <Textarea {...common} ref={ref as React.Ref<HTMLTextAreaElement>} />
      ) : (
        <Input {...common} ref={ref as React.Ref<HTMLInputElement>} />
      )}
      {items.length > 0 ? (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
          {items.map((entry) => (
            <button
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] hover:bg-accent"
              key={entry.tag}
              // mousedown fires before the field's blur, so `caret` is still valid
              onMouseDown={(e) => {
                e.preventDefault();
                pick(entry);
              }}
              type="button"
            >
              <span>{entry.display}</span>
              <span className="text-muted-foreground">
                {formatCount(entry.count)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
