/**
 * CEIPOL Design System - Design Tokens
 * Centraliza colores, estados semánticos y tamaños estándar para la interfaz táctica.
 */

export const CEIPOL_COLORS = {
  primary: "cyan",
  secondary: "indigo",
  success: "emerald",
  warning: "amber",
  danger: "red",
  neutral: "slate"
};

export const CEIPOL_STATUS = {
  VALIDATED: "validated",
  PENDING: "pending",
  WARNING: "warning",
  ERROR: "error",
  PROCESSING: "processing"
} as const;

export type CeipolStatus = typeof CEIPOL_STATUS[keyof typeof CEIPOL_STATUS];

export const CEIPOL_SIZE = {
  sm: "small",
  md: "medium",
  lg: "large"
} as const;

export type CeipolSize = typeof CEIPOL_SIZE[keyof typeof CEIPOL_SIZE];
