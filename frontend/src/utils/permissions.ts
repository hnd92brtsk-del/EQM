import type { AuthUser, SpacePermission } from "../api/auth";

export type SpaceKey =
  | "overview"
  | "personnel"
  | "equipment"
  | "cabinets"
  | "engineering"
  | "dictionaries"
  | "admin_users"
  | "admin_sessions"
  | "admin_audit"
  | "admin_diagnostics";

export type PermissionAction = "read" | "write" | "admin";

export const findPermission = (user: AuthUser | null | undefined, space: SpaceKey): SpacePermission | undefined =>
  user?.permissions?.find((permission) => permission.space_key === space);

export const hasPermission = (
  user: AuthUser | null | undefined,
  space: SpaceKey,
  action: PermissionAction = "read"
) => {
  const permission = findPermission(user, space);
  if (!permission) {
    return false;
  }
  if (action === "read") {
    return Boolean(permission.can_read || permission.can_write || permission.can_admin);
  }
  if (action === "write") {
    return Boolean(permission.can_write || permission.can_admin);
  }
  return Boolean(permission.can_admin);
};
