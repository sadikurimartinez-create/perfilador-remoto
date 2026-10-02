export type InstitutionalIdentity = { id: string | number; username: string; role: string };

export function institutionalFirebaseIdentity(user: InstitutionalIdentity) {
  const id = String(user.id ?? "").trim();
  if (!id || id.length > 123 || /[\/\\\x00-\x1f\x7f]/.test(id) || id === "." || id === ".." || !user.username?.trim()) throw new Error("INSTITUTIONAL_IDENTITY_INVALID");
  const role = user.role === "SUPERADMIN" ? "SUPER_ADMIN" : user.role;
  if (!["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) throw new Error("INSTITUTIONAL_ROLE_INVALID");
  return { uid: `user:${id}`, claims: { role, institutionalUserId: id } };
}
