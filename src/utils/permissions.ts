import { getAdminSession } from '../store';
import { AdminRole, CustomRole } from '../types';

export function getRole(): AdminRole | undefined {
  return getAdminSession().role;
}

export const ROLE_PERMISSIONS = {
  canView:           (r?: AdminRole) => !!r,
  canAddNotes:       (r?: AdminRole) => r === 'owner' || r === 'admin' || r === 'reviewer',
  canChangeStatus:   (r?: AdminRole) => r === 'owner' || r === 'admin',
  canEditRelease:    (r?: AdminRole) => r === 'owner' || r === 'admin',
  canDelete:         (r?: AdminRole) => r === 'owner' || r === 'admin',
  canBulkAction:     (r?: AdminRole) => r === 'owner' || r === 'admin',
  canAccessSettings: (r?: AdminRole) => r === 'owner' || r === 'admin',
  canEditSettings:   (r?: AdminRole) => r === 'owner' || r === 'admin',
  canManageTeam:     (r?: AdminRole) => r === 'owner',
  canExport:         (r?: AdminRole) => r === 'owner' || r === 'admin',
} as const;

let _customRoles: CustomRole[] = [];
export function setCustomRoles(roles: CustomRole[]) { _customRoles = roles; }
export function getCustomRolesCache() { return _customRoles; }

function resolveCustomRole(roleName: string) {
  return _customRoles.find(r => r.name.toLowerCase() === roleName.toLowerCase())?.permissions ?? null;
}

export function usePermissions() {
  const role = getRole();
  const builtIn = ['owner', 'admin', 'reviewer'];
  const isBuiltIn = !role || builtIn.includes(role);

  if (isBuiltIn) {
    return {
      role,
      isCustomRole: false,
      can: Object.fromEntries(
        Object.entries(ROLE_PERMISSIONS).map(([key, fn]) => [key, fn(role)])
      ) as { [K in keyof typeof ROLE_PERMISSIONS]: boolean },
    };
  }

  const custom = resolveCustomRole(role!);
  const p = custom ?? {};
  return {
    role,
    isCustomRole: true,
    can: {
      canView:           p.canView ?? false,
      canAddNotes:       p.canAddNotes ?? false,
      canChangeStatus:   p.canChangeStatus ?? false,
      canEditRelease:    p.canEditRelease ?? false,
      canDelete:         p.canDelete ?? false,
      canBulkAction:     p.canBulkAction ?? false,
      canAccessSettings: p.canAccessSettings ?? false,
      canEditSettings:   p.canAccessSettings ?? false,
      canManageTeam:     false,
      canExport:         p.canExport ?? false,
    },
  };
}
