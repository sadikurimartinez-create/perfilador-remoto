"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CrimeIncidenceWorkspace } from "@/components/crime-incidence/CrimeIncidenceWorkspace";
import type { Project } from "@/context/ProjectContext";
import { exportToWord } from "@/lib/exportToWord";
import type { CrimeIncidenceFilterQueryIntent } from "@/types/crimeIncidenceControlledFilters";
import type { CrimeIncidenceInstitutionalDocumentProduct } from "@/utils/crimeIncidenceWorkspaceExport";
import {
  composeCrimeIncidenceProductionWorkspace,
} from "@/utils/crimeIncidenceProductionComposition";
import type { CrimeIncidenceWorkspaceBindingResult } from "@/utils/crimeIncidenceWorkspaceBinding";

interface CrimeIncidenceProductionWorkspaceProps {
  project: Project;
  requestedBy?: string;
  user?: unknown;
}

const loadingBinding: CrimeIncidenceWorkspaceBindingResult = { state: "LOADING", viewModel: null, error: null };

export function CrimeIncidenceProductionWorkspace({ project, requestedBy, user }: CrimeIncidenceProductionWorkspaceProps) {
  const [binding, setBinding] = useState<CrimeIncidenceWorkspaceBindingResult>(loadingBinding);

  const execute = useCallback(async (filters?: CrimeIncidenceFilterQueryIntent["filters"]) => {
    setBinding(loadingBinding);
    const nextBinding = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: project.id,
      canonicalGeography: project.canonicalGeography,
      radiusMeters: project.analysisRadius,
      filters,
      requestedBy,
    });
    setBinding(nextBinding);
  }, [project.id, project.canonicalGeography, project.analysisRadius, requestedBy]);

  useEffect(() => {
    void execute();
  }, [execute]);

  const handleFilterRequest = useCallback(async (intent: CrimeIncidenceFilterQueryIntent) => {
    await execute(intent.filters);
  }, [execute]);

  const handleExportProduct = useCallback(async (product: CrimeIncidenceInstitutionalDocumentProduct) => {
    await exportToWord(
      {
        ...project,
        projectId: project.id,
        canonicalGeography: project.canonicalGeography,
        analysisOutputs: [product],
        crimeIncidenceExportContract: product.exportContract,
        institutionalMetadata: product.institutionalMetadata,
      },
      project.nombre,
      product.exportId ?? project.id,
      user,
      { exportMode: "INSTITUTIONAL" }
    );
  }, [project, user]);

  return (
    <CrimeIncidenceWorkspace
      binding={binding}
      onFilterRequest={handleFilterRequest}
      onExportProduct={handleExportProduct}
    />
  );
}
