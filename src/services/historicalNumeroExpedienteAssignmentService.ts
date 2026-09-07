import { doc, runTransaction } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  buildNumeroExpedienteFields,
  resolvePerfiladorIniciales,
} from "@/utils/documentIdentity";

const INSTITUTIONAL_NUMERO_EXPEDIENTE_PATTERN = /^\d{8}-\d{4}-[A-ZÑ]{2,5}$/;

function isValidInstitutionalNumeroExpediente(value: unknown): value is string {
  return typeof value === "string" && INSTITUTIONAL_NUMERO_EXPEDIENTE_PATTERN.test(value.trim().toLocaleUpperCase("es-MX"));
}

export async function assignNumeroExpedienteToExistingProject(
  projectId: string,
  user: Parameters<typeof resolvePerfiladorIniciales>[0]
) {
  const firestore = getDb();
  const projectRef = doc(firestore, "projects", projectId);
  const counterRef = doc(firestore, "counters", "projects");
  let assignedFields!: ReturnType<typeof buildNumeroExpedienteFields>;

  await runTransaction(firestore, async (transaction) => {
    const projectSnap = await transaction.get(projectRef);
    if (!projectSnap.exists()) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    const projectData = projectSnap.data();
    const existingNumeroExpediente = projectData.numeroExpediente;
    if (isValidInstitutionalNumeroExpediente(existingNumeroExpediente)) {
      assignedFields = {
        numeroExpediente: existingNumeroExpediente.trim(),
        numeroExpedienteAsignadoAt: projectData.numeroExpedienteAsignadoAt,
        numeroExpedienteSequence: projectData.numeroExpedienteSequence,
        perfiladorIniciales: projectData.perfiladorIniciales,
        numeroExpedienteVersion: projectData.numeroExpedienteVersion,
      };
      return;
    }

    const perfiladorIniciales = resolvePerfiladorIniciales(user);
    const counterSnap = await transaction.get(counterRef);
    const currentCount = counterSnap.exists() ? counterSnap.data().count || 0 : 0;
    const nextCount = currentCount + 1;
    assignedFields = buildNumeroExpedienteFields({
      createdAt: new Date(),
      sequence: nextCount,
      perfiladorIniciales,
    });

    transaction.set(counterRef, { count: nextCount });
    transaction.update(projectRef, { ...assignedFields });
  });

  return assignedFields;
}
