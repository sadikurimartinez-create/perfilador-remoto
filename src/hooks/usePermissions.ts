import { getPermissions }
  from '../utils/permissions';

import { UserRole }
  from '../types/Roles';

export const usePermissions = (
  role: UserRole
) => {

  return getPermissions(role);

};