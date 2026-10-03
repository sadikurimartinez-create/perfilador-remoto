"use client";
import React, { useEffect, useRef, useState } from "react";
import { useProject } from "@/context/ProjectContext";
import type { CanonicalProjectHypothesis } from "@/utils/hypothesisGovernance";

export function HumanHypothesisEditor() {
  const { project, isReadOnly, saveHumanHypothesis } = useProject();
  if (!project) return null;
  return <HypothesisEditor key={project.id}
    initialText={project.canonicalHypothesis?.text ?? project.hipotesis ?? ""}
    historicalAuthorUnknown={!project.canonicalHypothesis || project.canonicalHypothesis.status === "LEGACY_FORMULATED"}
    readOnly={isReadOnly} save={saveHumanHypothesis} />;
}

export function HypothesisEditor({ initialText, historicalAuthorUnknown, readOnly, save }: {
  initialText: string; historicalAuthorUnknown: boolean; readOnly: boolean;
  save: (text: string) => Promise<CanonicalProjectHypothesis>;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<CanonicalProjectHypothesis | null>(null);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const lastSavedText = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { setText(initialText); }, [initialText]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const handleSave = async () => {
    if (readOnly || pending.current || !text.trim() || lastSavedText.current === text.trim()) return;
    pending.current = true;
    setSaving(true);
    setError(false);
    try {
      // Persistence, versioning, authorship and audit remain in ProjectContext.
      const result = await save(text);
      lastSavedText.current = result.text;
      if (mounted.current) { setText(result.text); setSaved(result); }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return <section aria-labelledby="human-hypothesis-editor-title" className="max-w-4xl mx-auto mb-6 rounded-xl border border-slate-700 bg-slate-950/40 p-4 space-y-3">
    <h3 id="human-hypothesis-editor-title" className="font-semibold text-slate-200">Hipótesis Central Consolidada del Expediente</h3>
    <p className="text-xs text-slate-400">
      {historicalAuthorUnknown && "Hipótesis histórica: autor no acreditado. "}
      Guardar registra una nueva formulación humana atribuida al usuario autenticado; no certifica ni valida la hipótesis.
    </p>
    <label htmlFor="human-hypothesis-text" className="block text-xs text-slate-300">Texto de la hipótesis humana</label>
    <textarea id="human-hypothesis-text" value={text} rows={8}
      spellCheck={false} autoCorrect="off" autoCapitalize="off"
      disabled={readOnly || saving} onChange={event => setText(event.target.value)}
      className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200" />
    <button type="button" onClick={handleSave}
      disabled={readOnly || saving || !text.trim() || lastSavedText.current === text.trim()}
      className="rounded-lg bg-sky-700 px-4 py-2 text-sm text-white disabled:opacity-50">
      {saving ? "Guardando…" : "Guardar Hipótesis"}
    </button>
    {saved && <p role="status" className="text-xs text-emerald-300">
      Hipótesis guardada. Versión {saved.version}: {saved.status} / {saved.validationStatus}. Verifique la auditoría antes de repetir una actuación.
    </p>}
    {error && <p role="alert" className="text-xs text-red-300">
      No se pudo confirmar el guardado. Compruebe la hipótesis persistida y la auditoría antes de reintentar.
    </p>}
  </section>;
}
