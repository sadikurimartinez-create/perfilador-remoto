import React from "react";

import { selectPredictiveProductsForInstitutionalReport } from "@/utils/institutionalPredictiveProductIntegration";

interface Props {
  project: any;
}

const levelLabel: Record<string, string> = {
  DESCRIPTIVE: "DESCRIPTIVE",
  TREND: "TREND",
  PROSPECTIVE_SCENARIO: "PROSPECTIVE SCENARIO",
};

const PredictivePanel: React.FC<Props> = ({ project }) => {
  const selection = selectPredictiveProductsForInstitutionalReport(project, {
    expedienteId: project?.projectId || project?.id || project?.expedienteId || null,
    geographyId: project?.geographyId || project?.canonicalGeography?.geographyId || null,
    canonicalGeographyType: project?.canonicalGeography?.type || null,
  });

  return (
    <section className="mt-4 border border-slate-700 bg-slate-900 p-4">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-bold text-slate-100">Analisis prospectivo institucional</h2>
        <p className="text-xs text-slate-400">
          Productos analiticos aprobados por PPC y admitidos para consumo institucional.
        </p>
      </div>

      {selection.products.length === 0 ? (
        <div className="border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
          No hay productos prospectivos aprobados y vigentes para este expediente.
        </div>
      ) : (
        <div className="space-y-3">
          {selection.products.map((product) => (
            <article key={product.productId} className="border border-slate-700 bg-slate-950 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="border border-emerald-700 bg-emerald-950 px-2 py-1 font-semibold text-emerald-200">
                  {product.humanReviewStatus}
                </span>
                <span className="border border-sky-700 bg-sky-950 px-2 py-1 text-sky-200">
                  {levelLabel[product.analyticalLevel] || product.analyticalLevel}
                </span>
                <span className="border border-slate-700 px-2 py-1 text-slate-300">
                  Vigente hasta {new Date(product.validUntil).toLocaleDateString("es-MX")}
                </span>
              </div>

              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Escenario</dt>
                  <dd className="text-slate-100">{product.scenario}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Tendencia</dt>
                  <dd className="text-slate-100">{product.trend}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Confianza</dt>
                  <dd className="text-slate-100">{product.confidence}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Incertidumbre</dt>
                  <dd className="text-slate-100">{product.uncertaintyLevel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Relacion con hipotesis</dt>
                  <dd className="text-slate-100">{product.hypothesisRelation}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Revision PPC</dt>
                  <dd className="text-slate-100">
                    {product.reviewedBy} - {product.reviewedAt ? new Date(product.reviewedAt).toLocaleString("es-MX") : "N/D"}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 text-xs leading-relaxed text-slate-300">
                <p className="font-semibold text-slate-200">Limitaciones</p>
                <p>{product.limitations.join(" ")}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {selection.exclusions.length > 0 && (
        <div className="mt-4 border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-100">
          {selection.exclusions.length} producto(s) excluido(s) por gobernanza institucional.
        </div>
      )}
    </section>
  );
};

export default PredictivePanel;
