"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { DynamicModuleFallback } from "./DynamicModuleFallback";

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
    console.warn(`[MODULE FALLBACK] Módulo: ${this.props.moduleName}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  public render() {
    if (this.state.hasError) {
      return <DynamicModuleFallback moduleName={this.props.moduleName} />;
    }

    return this.props.children;
  }
}
