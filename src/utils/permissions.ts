import { getAdminSession } from '../store';
import { AdminRole } from '../types';

export function getRole(): AdminRole | undefined {
  return getAdminSession().role;
}

// What each role can do
export const ROLE_PERMISSIONS = {
  // Can view releases and navigate
  canView:          (r?: AdminRole) => !!r,

  // Can add/edit label notes only
  canAddNotes:      (r?: AdminRole) => r === 'owner' || r === 'admin' || r === 'reviewer',

  // Can change release status (approve, reject, schedule, etc.)
  canChangeStatus:  (r?: AdminRole) => r === 'owner' || r === 'admin',

  // Can edit release details (artist, tracks, dates, etc.)
  canEditRelease:   (r?: AdminRole) => r === 'owner' || r === 'admin',

  // Can delete individual releases
  canDelete:        (r?: AdminRole) => r === 'owner' || r === 'admin',

  // Can use bulk actions
  canBulkAction:    (r?: AdminRole) => r === 'owner' || r === 'admin',

  // Can access Settings panel at all
  canAccessSettings:(r?: AdminRole) => r === 'owner' || r === 'admin',

  // Can change branding, form config, integrations
  canEditSettings:  (r?: AdminRole) => r === 'owner' || r === 'admin',

  // Can manage team members (add/remove/change roles)
  canManageTeam:    (r?: AdminRole) => r === 'owner',

  // Can export CSV/PDF
  canExport:        (r?: AdminRole) => r === 'owner' || r === 'admin',
} as const;

export function usePermissions() {
  const role = getRole();
  return {
    role,
    can: Object.fromEntries(
      Object.entries(ROLE_PERMISSIONS).map(([key, fn]) => [key, fn(role)])
    ) as { [K in keyof typeof ROLE_PERMISSIONS]: boolean },
  };
}
