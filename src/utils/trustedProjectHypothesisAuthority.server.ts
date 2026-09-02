import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServerDb } from "@/lib/firebaseServer";
import { verifySession } from "@/utils/authCrypto";
import {
  adaptLegacyProjectHypothesis,
  canProceedWithInstitutionalAnalysis,
  type CanonicalProjectHypothesis,
} from "@/utils/hypothesisGovernance";

type SessionIdentity = {
  username?: string;
  role?: string;
};

type PersistedProject = Record<string, unknown>;

export type TrustedHypothesisAuthorityResult =
  | {
      allowed: true;
      canonicalHypothesis: CanonicalProjectHypothesis;
      project: PersistedProject;
      session: Required<Pick<SessionIdentity, "username">> & SessionIdentity;
    }
  | {
      allowed: false;
      status: 400 | 401 | 403 | 404 | 422 | 503;
      code:
        | "PROJECT_ID_REQUIRED"
        | "INVALID_SESSION"
        | "PROJECT_ACCESS_DENIED"
        | "PROJECT_NOT_FOUND"
        | "HUMAN_HYPOTHESIS_REQUIRED"
        | "PROJECT_READ_FAILED";
      message: string;
    };

export type TrustedHypothesisAuthorityDependencies = {
  verifySessionToken: (token: string) => SessionIdentity | null;
  readProject: (projectId: string) => Promise<PersistedProject | null>;
};

const defaultDependencies: TrustedHypothesisAuthorityDependencies = {
  verifySessionToken: verifySession,
  async readProject(projectId) {
    const snapshot = await getDoc(doc(getFirebaseServerDb(), "projects", projectId));
    return snapshot.exists() ? snapshot.data() : null;
  },
};

export async function authorizeTrustedProjectHypothesis(input: {
  projectId: unknown;
  sessionToken: string | null | undefined;
  dependencies?: TrustedHypothesisAuthorityDependencies;
}): Promise<TrustedHypothesisAuthorityResult> {
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  if (!projectId) {
    return { allowed: false, status: 400, code: "PROJECT_ID_REQUIRED", message: "Se requiere un projectId válido." };
  }

  const dependencies = input.dependencies || defaultDependencies;
  const session = input.sessionToken ? dependencies.verifySessionToken(input.sessionToken) : null;
  if (!session?.username) {
    return { allowed: false, status: 401, code: "INVALID_SESSION", message: "Sesión inválida o expirada." };
  }

  let project: PersistedProject | null;
  try {
    project = await dependencies.readProject(projectId);
  } catch {
    return { allowed: false, status: 503, code: "PROJECT_READ_FAILED", message: "No fue posible verificar el expediente persistido." };
  }
  if (!project) {
    return { allowed: false, status: 404, code: "PROJECT_NOT_FOUND", message: "El expediente solicitado no existe." };
  }

  if (session.role === "USER" && project.createdBy !== session.username) {
    return { allowed: false, status: 403, code: "PROJECT_ACCESS_DENIED", message: "El usuario no tiene acceso al expediente solicitado." };
  }

  const canonicalHypothesis = adaptLegacyProjectHypothesis({ ...project, id: projectId, projectId });
  const gate = canProceedWithInstitutionalAnalysis({ canonicalHypothesis });
  if (!canonicalHypothesis || canonicalHypothesis.projectId !== projectId || !gate.allowed) {
    return {
      allowed: false,
      status: 422,
      code: "HUMAN_HYPOTHESIS_REQUIRED",
      message: "El expediente persistido requiere una hipótesis humana formulada antes de generar el perfil institucional.",
    };
  }

  return {
    allowed: true,
    canonicalHypothesis,
    project,
    session: { ...session, username: session.username },
  };
}
