"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MiniSearch from "minisearch";
import {
  buildIndex,
  removeDoc,
  replaceDoc,
  search as runSearch,
  type SearchDoc,
  type SearchHit,
} from "@/lib/search-index";
import type { JSONContent } from "@tiptap/react";

export const SEARCH_DOC_SAVED_EVENT = "hpp:search-doc-saved";
export const SEARCH_TREE_CHANGED_EVENT = "hpp:search-tree-changed";

type SourceResponse = { docs: SearchDoc[] };

function nodeText(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  if (!node.content) return "";
  return node.content.map(nodeText).join(" ");
}

function docText(doc: JSONContent | null | undefined): string {
  if (!doc?.content) return "";
  return doc.content.map(nodeText).join(" ").replace(/\s+/g, " ").trim();
}

export type UseSearch = {
  ready: boolean;
  textByPath: Map<string, string>;
  search: (query: string) => SearchHit[];
};

export function useSearch(): UseSearch {
  const indexRef = useRef<MiniSearch<SearchDoc> | null>(null);
  const textByPathRef = useRef<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);
  const [, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function rebuild() {
      try {
        const res = await fetch("/api/search-source");
        if (!res.ok) throw new Error(String(res.status));
        const { docs }: SourceResponse = await res.json();
        if (cancelled) return;
        indexRef.current = buildIndex(docs);
        textByPathRef.current = new Map(docs.map((d) => [d.path, d.text]));
        setReady(true);
        setVersion((v) => v + 1);
      } catch {
        if (!cancelled) setReady(false);
      }
    }

    async function replaceFromServer(path: string) {
      const index = indexRef.current;
      if (!index) return;
      try {
        const parts = path
          .split("/")
          .filter(Boolean)
          .map(encodeURIComponent)
          .join("/");
        const res = await fetch(`/api/file/${parts}`);
        if (!res.ok) {
          removeDoc(index, path);
          textByPathRef.current.delete(path);
        } else {
          const { content } = await res.json();
          const text = docText(content);
          replaceDoc(index, { path, text });
          textByPathRef.current.set(path, text);
        }
        setVersion((v) => v + 1);
      } catch {
        // ignore — index keeps stale entry, will refresh on full rebuild
      }
    }

    void rebuild();

    function onSaved(e: Event) {
      const path = (e as CustomEvent<{ path: string }>).detail?.path;
      if (path) void replaceFromServer(path);
    }
    function onTreeChange() {
      void rebuild();
    }

    window.addEventListener(SEARCH_DOC_SAVED_EVENT, onSaved);
    window.addEventListener(SEARCH_TREE_CHANGED_EVENT, onTreeChange);

    return () => {
      cancelled = true;
      window.removeEventListener(SEARCH_DOC_SAVED_EVENT, onSaved);
      window.removeEventListener(SEARCH_TREE_CHANGED_EVENT, onTreeChange);
    };
  }, []);

  const search = useCallback((query: string) => {
    const index = indexRef.current;
    if (!index) return [];
    return runSearch(index, query);
  }, []);

  return {
    ready,
    textByPath: textByPathRef.current,
    search,
  };
}

export function notifyDocSaved(path: string) {
  window.dispatchEvent(
    new CustomEvent(SEARCH_DOC_SAVED_EVENT, { detail: { path } }),
  );
}

export function notifyTreeChanged() {
  window.dispatchEvent(new CustomEvent(SEARCH_TREE_CHANGED_EVENT));
}
