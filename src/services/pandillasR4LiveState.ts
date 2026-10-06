import 'server-only';
import type { Firestore, Transaction, Query } from 'firebase-admin/firestore';
import { R4InjectionError, R4_INJECTION_PROJECT_ID, type R4PlanSnapshot } from './pandillasR4ImageInjectionPlan';
import { assertR4LivePrecondition, r4LivePreconditionFingerprint } from './pandillasR4LiveReadiness';

const groups = { pandillasMemberIdentities: 'identities', documents: 'documents',
  pandillasPhotoAssociations: 'associations', pandillasPrimarySelections: 'selections' } as const;
export async function readR4TransactionState(db: Firestore, tx: Transaction): Promise<R4PlanSnapshot> {
  const parent = db.collection('projects').doc(R4_INJECTION_PROJECT_ID);
  const doc = await tx.get(parent);
  const version = (row: any) => row.updateTime ? [row.updateTime.seconds, row.updateTime.nanoseconds] : null;
  const rows = async (query: Query, maximum: number) => {
    const result = await tx.get(query.limit(maximum + 1));
    if (result.size > maximum) throw new R4InjectionError('R4_PREFLIGHT_CAPACITY_EXCEEDED', 503);
    return result.docs.map(row => {
      const data = row.data();
      if (data.id !== undefined && data.id !== row.id) throw new R4InjectionError('R4_PERSISTED_STATE_INVALID', 409);
      return { ...data, id: row.id, _r4ReadVersion: version(row) };
    });
  };
  return { project: doc.exists === false ? undefined : { ...doc.data(), _r4ReadVersion: version(doc) },
    gangs: await rows(db.collection('pandillas').where('projectId', '==', R4_INJECTION_PROJECT_ID), 25),
    identities: await rows(parent.collection('pandillasMemberIdentities'), 1000),
    documents: await rows(parent.collection('documents'), 10000),
    associations: await rows(parent.collection('pandillasPhotoAssociations'), 1000),
    selections: await rows(parent.collection('pandillasPrimarySelections'), 1000) };
}
export const readR4LiveState = (db: Firestore) => db.runTransaction(tx => readR4TransactionState(db, tx), { readOnly: true });

function withoutReadVersions(state: R4PlanSnapshot): R4PlanSnapshot {
  const strip = (row: any) => { if (!row) return row; const { _r4ReadVersion, ...data } = row; return data; };
  return { project: strip(state.project), gangs: state.gangs.map(strip), identities: state.identities.map(strip),
    documents: state.documents.map(strip), associations: state.associations.map(strip), selections: state.selections.map(strip) };
}
/** Guards existing institutional transactions; creates no lock collection or new schema.
 * Every attempt reads the full precondition in the SAME transaction before writes.
 * After commit, only the recorded writes may explain changes to the checkpoint. */
export function guardedR4Database(db: Firestore, initial: R4PlanSnapshot, reauthorize: () => Promise<void>) {
  let checkpoint = initial;
  let writesPerformed = 0;
  const guarded = new Proxy(db, { get(target, property) {
    if (property !== 'runTransaction') { const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value; }
    return async (callback: (tx: Transaction) => Promise<any>, options?: any) => {
      await reauthorize();
      let projected: R4PlanSnapshot = checkpoint;
      let count = 0;
      let touched = new Set<string>();
      const result = await db.runTransaction(async tx => {
        const current = await readR4TransactionState(db, tx);
        assertR4LivePrecondition(r4LivePreconditionFingerprint(checkpoint), current);
        projected = withoutReadVersions(current); count = 0; touched = new Set<string>();
        const wrapped = new Proxy(tx, { get(transaction, key) {
          if (!['create', 'set', 'update', 'delete'].includes(String(key))) {
            const value = Reflect.get(transaction, key); return typeof value === 'function' ? value.bind(transaction) : value;
          }
          return (ref: any, data?: any, settings?: any) => {
            if (key === 'delete') throw new R4InjectionError('R4_DELETE_FORBIDDEN', 409);
            count++;
            touched.add(ref.path);
            const parts = ref.path.split('/');
            if (ref.path === `projects/${R4_INJECTION_PROJECT_ID}`) {
              if (key !== 'update' || Object.keys(data).some(field => field !== 'institutionalSourceRevision')) throw new R4InjectionError('R4_PROJECT_PATCH_FORBIDDEN', 409);
              projected.project = { ...projected.project, ...data };
            } else if (parts[0] === 'pandillas') throw new R4InjectionError('R4_GANG_WRITE_FORBIDDEN', 409);
            else if (parts[0] === 'projects' && parts[1] === R4_INJECTION_PROJECT_ID && parts.length === 4 && parts[2] in groups) {
              const group = groups[parts[2] as keyof typeof groups];
              const prior = projected[group].find(row => row.id === parts[3]);
              if (key === 'update' || settings?.merge) throw new R4InjectionError('R4_UNSUPPORTED_PARTIAL_WRITE', 409);
              projected[group] = [...projected[group].filter(row => row.id !== parts[3]), { ...data, id: parts[3] }];
              if (key === 'create' && prior) throw new R4InjectionError('R4_DUPLICATE_ENTITY', 409);
            }
            const method = Reflect.get(transaction, key).bind(transaction);
            return settings === undefined ? method(ref, data) : method(ref, data, settings);
          };
        } });
        return callback(wrapped);
      }, options);
      writesPerformed += count;
      const after = await readR4LiveState(db);
      if (r4LivePreconditionFingerprint(withoutReadVersions(after)) !== r4LivePreconditionFingerprint(projected)) {
        throw new R4InjectionError('R4_LIVE_PRECONDITION_CHANGED', 409);
      }
      // A same-value external rewrite still invalidates untouched Firestore read versions.
      const version = (row: any) => JSON.stringify(row?._r4ReadVersion ?? null);
      if (!touched.has(`projects/${R4_INJECTION_PROJECT_ID}`) && version(after.project) !== version(checkpoint.project)) throw new R4InjectionError('R4_LIVE_PRECONDITION_CHANGED', 409);
      for (const [kind, group] of Object.entries(groups)) {
        for (const row of checkpoint[group]) {
          if (!touched.has(`projects/${R4_INJECTION_PROJECT_ID}/${kind}/${row.id}`)
            && version(row) !== version(after[group].find(candidate => candidate.id === row.id))) throw new R4InjectionError('R4_LIVE_PRECONDITION_CHANGED', 409);
        }
      }
      for (const gang of checkpoint.gangs) {
        if (version(gang) !== version(after.gangs.find(row => row.id === gang.id))) throw new R4InjectionError('R4_LIVE_PRECONDITION_CHANGED', 409);
      }
      checkpoint = after;
      return result;
    };
  } });
  return { database: guarded, state: () => checkpoint, writes: () => writesPerformed,
    assertCurrent: async () => { await reauthorize(); assertR4LivePrecondition(r4LivePreconditionFingerprint(checkpoint), await readR4LiveState(db)); } };
}
