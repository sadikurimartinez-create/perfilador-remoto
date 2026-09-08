function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function makeFirestoreSafe<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => makeFirestoreSafe(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const clean: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      clean[key] = makeFirestoreSafe(item);
    }
  }
  return clean as T;
}

export function containsUndefinedDeep(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some((item) => containsUndefinedDeep(item));
  if (!isPlainObject(value)) return false;
  return Object.values(value).some((item) => containsUndefinedDeep(item));
}
