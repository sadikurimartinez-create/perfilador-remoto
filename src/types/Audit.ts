export interface AuditLog {

  id: string;

  action: string;

  userRole: string;

  username: string;

  timestamp: string;

  details?: string;

}