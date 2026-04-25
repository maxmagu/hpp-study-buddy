"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_GLOSSARY,
  GLOSSARY_PATH,
  parseGlossary,
  type Glossary,
} from "@/lib/glossary";

export const GLOSSARY_UPDATED_EVENT = "hpp:glossary-updated";

export function useGlossary(): Glossary {
  const [glossary, setGlossary] = useState<Glossary>(EMPTY_GLOSSARY);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/file/${encodeURIComponent(GLOSSARY_PATH)}`);
        if (!res.ok) {
          if (!cancelled) setGlossary(EMPTY_GLOSSARY);
          return;
        }
        const { content } = await res.json();
        if (!cancelled) setGlossary(parseGlossary(content));
      } catch {
        if (!cancelled) setGlossary(EMPTY_GLOSSARY);
      }
    }

    load();
    const onUpdated = () => {
      void load();
    };
    window.addEventListener(GLOSSARY_UPDATED_EVENT, onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(GLOSSARY_UPDATED_EVENT, onUpdated);
    };
  }, []);

  return glossary;
}

export function notifyGlossaryUpdated() {
  window.dispatchEvent(new CustomEvent(GLOSSARY_UPDATED_EVENT));
}
