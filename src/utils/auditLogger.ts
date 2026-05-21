import { AuditLog }
  from '../types/Audit';

export const createAuditLog = (
  action: string,
  userRole: string,
  username: string,
  details?: string
): AuditLog => {

  return {

    id:
      `${Date.now()}-${Math.random()}`,

    action,

    userRole,

    username,

    timestamp:
      new Date().toISOString(),

    details,

  };
};

export const appendAuditLog = (
  project: any,
  log: AuditLog
) => {

  if (!project.auditLogs) {
    project.auditLogs = [];
  }

  project.auditLogs.push(log);

  return project.auditLogs;
};