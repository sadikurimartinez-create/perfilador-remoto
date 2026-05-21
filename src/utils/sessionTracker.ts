import { UserSession }
  from '../types/Session';

export const createSession = (
  username: string,
  userRole: string,
  activeModule: string
): UserSession => {

  return {

    id:
      `${Date.now()}-${Math.random()}`,

    username,

    userRole,

    startedAt:
      new Date().toISOString(),

    lastActivity:
      new Date().toISOString(),

    activeModule,

    actions: [],

  };
};

export const appendSessionAction = (
  session: UserSession,
  action: string
) => {

  session.actions.push(action);

  session.lastActivity =
    new Date().toISOString();

  return session;
};