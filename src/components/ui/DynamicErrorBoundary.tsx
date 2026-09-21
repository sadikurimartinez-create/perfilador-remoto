"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { DynamicModuleFallback } from "./DynamicModuleFallback";
import { classifyDynamicModuleFailure } from "../../utils/dynamicModuleFailure";

interface Props {
  moduleName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary Específico para Módulos Dinámicos Secundarios.
 * Captura ChunkLoadError y excepciones de renderizado en componentes secundarios
 * previniendo el colapso del expediente.
 */
export class DynamicErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void errorInfo;
    console.warn(`[MODULE FALLBACK] Módulo: ${this.props.moduleName}`, classifyDynamicModuleFailure(error));
  }

  public render() {
    if (this.state.hasError) {
      return <DynamicModuleFallback moduleName={this.props.moduleName} />;
    }

    return this.props.children;
  }
}
