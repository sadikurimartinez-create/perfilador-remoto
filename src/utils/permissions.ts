import { UserRole }
  from '../types/Roles';

interface PermissionSet {

  canDeleteProjects: boolean;

  canExportReports: boolean;

  canViewExecutiveDashboard: boolean;

  canRunAdvancedIA: boolean;

  canManageUsers: boolean;

}

export const getPermissions = (
  role: UserRole
): PermissionSet => {

  switch (role) {

    case 'SUPER_ADMIN':

      return {

        canDeleteProjects: true,

        canExportReports: true,

        canViewExecutiveDashboard: true,

        canRunAdvancedIA: true,

        canManageUsers: true,

      };

    case 'ADMIN':

      return {

        canDeleteProjects: true,

        canExportReports: true,

        canViewExecutiveDashboard: true,

        canRunAdvancedIA: true,

        canManageUsers: false,

      };

    case 'ANALISTA':

      return {

        canDeleteProjects: false,

        canExportReports: true,

        canViewExecutiveDashboard: false,

        canRunAdvancedIA: true,

        canManageUsers: false,

      };

    default:

      return {

        canDeleteProjects: false,

        canExportReports: false,

        canViewExecutiveDashboard: false,

        canRunAdvancedIA: false,

        canManageUsers: false,

      };

  }

};