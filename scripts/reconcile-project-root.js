#!/usr/bin/env node
const { spawnSync } = require("child_process");

function relaunchWithSystemCaIfNeeded() {
  if (process.execArgv.includes("--use-system-ca") || process.env.P4U_SYSTEM_CA_REEXEC === "1") return;
  const result = spawnSync(process.execPath, ["--use-system-ca", ...process.execArgv, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, P4U_SYSTEM_CA_REEXEC: "1" },
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

relaunchWithSystemCaIfNeeded();

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
  },
});
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps, getApp } = require("firebase-admin/app");
const { initializeFirestore, FieldValue } = require("firebase-admin/firestore");
const { planProjectRootReconciliation } = require("../src/utils/projectRootReconciliation");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function idsList(items) {
  return items.length > 0 ? items.map((item) => item.id).join(", ") : "none";
}

function loadServiceAccount() {
  const explicit = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const filePath = explicit || path.join(__dirname, "..", "serviceAccountKey.json");
  if (!fs.existsSync(filePath)) {
    throw new Error("FIREBASE_ADMIN_CREDENTIALS_NOT_FOUND");
  }
  return require(filePath);
}

function initAdmin() {
  if (getApps().length > 0) return getApp();
  return initializeApp({ credential: cert(loadServiceAccount()) });
}

async function readCanonicalFindingIds(projectRef) {
  const snap = await projectRef.collection("streetview_findings").get();
  return new Set(snap.docs.map((doc) => doc.id));
}

async function main() {
  const projectId = argValue("--project-id");
  const dryRun = !process.argv.includes("--apply");
  if (!projectId) {
    throw new Error("Uso: node scripts/reconcile-project-root.js --project-id <id> [--dry-run|--apply]");
  }

  const app = initAdmin();
  const db = initializeFirestore(app, { preferRest: true });
  const projectRef = db.collection("projects").doc(projectId);
  const snap = await projectRef.get();
  if (!snap.exists) throw new Error(`PROJECT_NOT_FOUND:${projectId}`);

  const root = snap.data();
  const plan = planProjectRootReconciliation({ projectId, project: root, dryRun });
  const existingCanonicalIds = await readCanonicalFindingIds(projectRef);
  const missingCanonical = plan.canonicalFindingUpserts.filter((op) => !existingCanonicalIds.has(op.id));
  const oneMib = 1_048_576;
  const approvedFindingsCount = Array.isArray(root.approvedFindings) ? root.approvedFindings.length : 0;
  const refFields = ["approvedFindingRefs", "streetViewFindingRefs"];
  const missingRefFields = refFields.filter((field) => !Array.isArray(root[field]));

  console.log("P4-U PROJECT ROOT RECONCILIATION");
  console.log(`projectId: ${projectId}`);
  console.log(`mode: ${dryRun ? "DRY_RUN" : "APPLY"}`);
  console.log(`project root total before: ${formatKb(plan.totalBytesBefore)}`);
  console.log(`project root estimated after: ${formatKb(plan.totalBytesAfter)}`);
  console.log(`estimated savings: ${formatKb(plan.estimatedBytesSaved)}`);
  console.log(`estimated margin against 1MiB after: ${formatKb(oneMib - plan.totalBytesAfter)}`);
  console.log("\nTop root fields:");
  for (const item of plan.inventory.slice(0, 12)) {
    console.log(`${item.field}\t${formatKb(item.bytes)}\tcount=${item.count ?? "n/a"}\tremove=${item.canRemoveFromRoot}`);
  }
  console.log("\nCounts:");
  console.log(`approved findings: ${approvedFindingsCount}`);
  console.log(`canonical findings existing: ${existingCanonicalIds.size}`);
  console.log(`canonical upserts proposed: ${plan.canonicalFindingUpserts.length}`);
  console.log(`canonical upserts missing: ${missingCanonical.length}`);
  console.log(`canonical upserts missing ids: ${idsList(missingCanonical)}`);
  console.log(`root ref fields missing before patch: ${missingRefFields.join(", ") || "none"}`);
  console.log("\nProposed canonical upserts:");
  console.log(`streetview_findings missing/preserved: ${missingCanonical.length}/${plan.canonicalFindingUpserts.length}`);
  console.log("Proposed root removals:", plan.removeRootFields.join(", ") || "none");
  if (plan.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of plan.warnings) console.log(`- ${warning}`);
  }

  if (dryRun) {
    console.log("\nDRY_RUN: no writes executed.");
    return;
  }

  if (missingCanonical.length > 0) {
    const preserveBatch = db.batch();
    for (const op of missingCanonical) {
      preserveBatch.set(projectRef.collection("streetview_findings").doc(op.id), op.data, { merge: true });
    }
    await preserveBatch.commit();
  }

  const verifiedCanonicalIds = await readCanonicalFindingIds(projectRef);
  const unverifiedCanonical = plan.canonicalFindingUpserts.filter((op) => !verifiedCanonicalIds.has(op.id));
  if (unverifiedCanonical.length > 0) {
    throw new Error(`CANONICAL_FINDINGS_NOT_VERIFIED:${unverifiedCanonical.map((op) => op.id).join(",")}`);
  }

  const compactBatch = db.batch();
  const rootPatch = { ...plan.rootPatch };
  for (const field of plan.removeRootFields) {
    rootPatch[field] = FieldValue.delete();
  }
  compactBatch.set(projectRef, rootPatch, { merge: true });
  await compactBatch.commit();

  const verifySnap = await projectRef.get();
  const verifyPlan = planProjectRootReconciliation({ projectId, project: verifySnap.data(), dryRun: true });
  console.log("\nAPPLY complete.");
  console.log(`project root total after readback: ${formatKb(verifyPlan.totalBytesBefore)}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exitCode = 1;
});
