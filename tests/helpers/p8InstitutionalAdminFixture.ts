export function adminFixture(seed: Record<string, any> = {}) {
  const clone = (value: any) => value === undefined ? undefined : structuredClone(value);
  let records = new Map(Object.entries(seed).map(([key,value]) => [key,clone(value)]));
  let failPath: string | null = null; let failCommit = false; let generated = 0;
  const snap = (path: string, source = records) => ({ id: path.split('/').pop(), exists: source.has(path), data: () => clone(source.get(path)) });
  const ref = (path: string): any => ({ path, id: path.split('/').pop(), collection: (name: string) => collection(path+'/'+name),
    get: async () => snap(path), create: async (data: any) => { if (records.has(path)) throw new Error('IMMUTABLE'); records.set(path,clone(data)); },
    set: async (data: any) => { records.set(path,clone(data)); }, delete: async () => { records.delete(path); } });
  const collection = (path: string, conditions: any[] = [], maximum = Infinity): any => ({
    doc: (id?: string) => ref(path+'/'+(id ?? 'fixture-'+(++generated))),
    where: (field: string, operator: string, value: any) => collection(path,[...conditions,[field,operator,value]],maximum),
    orderBy: () => collection(path,conditions,maximum), limit: (n: number) => collection(path,conditions,n),
    get: async () => ({ docs: Array.from(records.keys()).filter(key => key.startsWith(path+'/') && key.slice(path.length+1).indexOf('/') < 0)
      .filter(key => conditions.every(([field,operator,value]) => { const stored = field.split('.').reduce((v: any,k: string) => v?.[k],records.get(key)); return operator === 'in' ? value.includes(stored) : stored === value; }))
      .slice(0,maximum).map(key => snap(key)) }),
  });
  const db: any = { doc: ref, collection, getAll: async (...refs: any[]) => refs.map(r => snap(r.path)),
    runTransaction: async (work: any) => {
      const staged = new Map(Array.from(records.entries()).map(([key,value]) => [key,clone(value)])); let written = false;
      const mutation = (r: any, value?: any, mode = 'set', options?: any) => {
        written = true; if (failPath && r.path.includes(failPath)) throw new Error('OFFLINE_WRITE_FAILURE');
        if (mode === 'delete') { staged.delete(r.path); return; }
        if (mode === 'create' && staged.has(r.path)) throw new Error('IMMUTABLE');
        if (mode === 'update' && !staged.has(r.path)) throw new Error('NOT_FOUND');
        staged.set(r.path,options?.merge || mode === 'update' ? { ...staged.get(r.path),...clone(value) } : clone(value));
      };
      const result = await work({ get: async (r: any) => { if (written) throw new Error('READ_AFTER_WRITE'); return snap(r.path,staged); },
        set: (r: any,data: any,options?: any) => mutation(r,data,'set',options), create: (r: any,data: any) => mutation(r,data,'create'), update: (r: any,data: any) => mutation(r,data,'update'), delete: (r: any) => mutation(r,undefined,'delete') });
      if (failCommit) throw new Error('OFFLINE_COMMIT_FAILURE'); records = staged; return result;
    },
  };
  return { db, entries: () => Array.from(records.entries()), get: (path: string) => clone(records.get(path)),
    seed: (path: string,data: any) => records.set(path,clone(data)), failWrite: (path: string|null) => { failPath = path; }, failCommit: (fail: boolean) => { failCommit = fail; } };
}
