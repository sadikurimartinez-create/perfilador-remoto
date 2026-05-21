export interface UserSession {

  id: string;

  username: string;

  userRole: string;

  startedAt: string;

  lastActivity: string;

  activeModule: string;

  actions: string[];

}