"use client";
import { readInstitutionalCollection } from "@/lib/institutionalCollectionActions";

/** Scoped replacement for global onSnapshot queries. PostgreSQL explicit grants
 * govern every refresh; errors clear stale records rather than show cached data. */
export function subscribeInstitutionalCollection(name: string, onSnapshot: (snapshot: {
  docs: { id: string; data(): Record<string, any> }[];
}) => void) {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async () => {
    try {
      const records = await readInstitutionalCollection(name);
      if (active) onSnapshot({ docs: records.map(record => ({ id: record.id, data: () => record })) });
    } catch {
      if (active) onSnapshot({ docs: [] });
    }
    if (active) timer = setTimeout(() => { void refresh(); }, 30000);
  };
  void refresh();
  return () => { active = false; if (timer) clearTimeout(timer); };
}
