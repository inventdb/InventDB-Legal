/**
 * Search the whole firm: one box that looks through every module at once.
 *
 * Each module is asked for its first few matches with the same `?q=` its own
 * list uses, so a result here is exactly what that module's search would have
 * found. Choosing one opens the record (`?focus=`) in its own section.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

import { api } from "../api/client";
import { ENTITIES, recordTitle } from "../config/entities";
import { canRead } from "../config/access";
import type { ListResponse, Record as Rec } from "../types";

const PER_MODULE = 3;
const MAX_RESULTS = 10;

export interface SearchHit {
  entity: string;
  module: string;
  id: string;
  key: string;
  title: string;
}

/** Debounced firm-wide matches for `term` (two characters or more). */
export function useFirmSearch(term: string) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const enabled = q.length >= 2;
  // Only the modules this person can read: a search never reaches past them.
  const modules = ENTITIES.filter((cfg) => canRead(cfg.name));
  const results = useQueries({
    queries: modules.map((cfg) => ({
      queryKey: ["firm-search", cfg.name, q],
      enabled,
      staleTime: 30_000,
      queryFn: async () => {
        const { data } = await api.get<ListResponse>(`/${cfg.name}`, {
          params: { q, limit: PER_MODULE },
        });
        return (data.items ?? []) as Rec[];
      },
    })),
  });

  const hits = useMemo(() => {
    if (!enabled) return [];
    const out: SearchHit[] = [];
    results.forEach((r, i) => {
      const cfg = modules[i];
      for (const row of r.data ?? []) {
        if (row._id == null) continue;
        out.push({
          entity: cfg.name,
          module: cfg.labelPlural,
          id: String(row._id),
          key: row[cfg.key] != null ? String(row[cfg.key]) : "",
          title: recordTitle(cfg, row),
        });
      }
    });
    return out.slice(0, MAX_RESULTS);
    // `results` is a new array every render; its data is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...results.map((r) => r.data)]);

  return {
    hits,
    ready: enabled,
    loading: enabled && results.some((r) => r.isLoading),
    pending: term.trim() !== q,
  };
}

export function hitPath(hit: SearchHit): string {
  return `/${hit.entity}?focus=${encodeURIComponent(hit.id)}`;
}

/** The hit list, shared by the masthead dropdown and the phone's search screen. */
export function SearchHits({
  term,
  hits,
  loading,
  onPick,
}: {
  term: string;
  hits: SearchHit[];
  loading: boolean;
  onPick: (hit: SearchHit) => void;
}) {
  if (hits.length === 0) {
    return (
      <p className="cb-gres-none">
        {loading ? "Searching the books…" : `Nothing in the books matches “${term.trim()}”.`}
      </p>
    );
  }
  return (
    <>
      {hits.map((h) => (
        <button
          key={`${h.entity}:${h.id}`}
          type="button"
          role="option"
          aria-selected="false"
          className="cb-gres"
          onClick={() => onPick(h)}
        >
          <span className="t">{h.title}</span>
          <span className="m">{h.module}</span>
          {h.key && h.key !== h.title && <span className="s">{h.key}</span>}
        </button>
      ))}
    </>
  );
}

/** The desktop masthead's search box, with its results dropping beneath it. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { hits, ready, loading, pending } = useFirmSearch(term);

  // Ctrl/⌘ K from anywhere puts you in the box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (hit: SearchHit) => {
    setOpen(false);
    setTerm("");
    navigate(hitPath(hit));
  };

  return (
    <div className="cb-gsearch" ref={box}>
      <label className="cb-gfield">
        <Search size={16} aria-hidden />
        <span className="sr-only">Search the whole firm</span>
        <input
          ref={input}
          value={term}
          placeholder="Search the firm"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            }
            if (e.key === "Enter" && hits[0]) pick(hits[0]);
          }}
        />
        <span className="cb-kbd" aria-hidden>
          Ctrl K
        </span>
      </label>
      {open && ready && (
        <div className="cb-pop cb-gresults" role="listbox" aria-label="Search results">
          <SearchHits term={term} hits={hits} loading={loading || pending} onPick={pick} />
        </div>
      )}
    </div>
  );
}
