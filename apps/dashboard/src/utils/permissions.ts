// =============================================================================
// Permission Utilities
// File: apps/dashboard/src/utils/permissions.ts
// =============================================================================
// Helper functions for checking user permissions and roles
// =============================================================================

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type Permission =
    | 'orders:create'
    | 'orders:read'
    | 'orders:cancel'
    | 'orders:read_all'
    | 'positions:read'
    | 'positions:read_all'
    | 'market:read'
    | 'market:subscribe'
    | 'accounts:read'
    | 'accounts:read_all'
    | 'accounts:create'
    | 'accounts:update'
    | 'accounts:delete'
    | 'risk:read'
    | 'risk:manage'
    | 'strategies:read'
    | 'strategies:create'
    | 'strategies:execute'
    | 'admin:full'
    | 'system:internal';

export type Role = 'admin' | 'trader' | 'viewer' | 'risk_manager' | 'system';

// =============================================================================
// PERMISSION CHECKERS
// =============================================================================

/**
 * Check if user has a specific permission
 */
export const hasPermission = (
    userPermissions: string[] | undefined,
    requiredPermission: Permission | Permission[]
): boolean => {
    if (!userPermissions || userPermissions.length === 0) return false;

    // Admin with full access
    if (userPermissions.includes('admin:full')) return true;

    // Check single permission
    if (typeof requiredPermission === 'string') {
        return userPermissions.includes(requiredPermission);
    }

    // Check any of multiple permissions
    return requiredPermission.some((perm) => userPermissions.includes(perm));
};

/**
 * Check if user has ALL required permissions
 */
export const hasAllPermissions = (
    userPermissions: string[] | undefined,
    requiredPermissions: Permission[]
): boolean => {
    if (!userPermissions || userPermissions.length === 0) return false;
    if (userPermissions.includes('admin:full')) return true;

    return requiredPermissions.every((perm) => userPermissions.includes(perm));
};

// =============================================================================
// FEATURE FLAGS
// =============================================================================

/**
 * Check if user can trade (create orders)
 */
export const canTrade = (permissions: string[] | undefined): boolean => {
    return hasPermission(permissions, 'orders:create');
};

/**
 * Check if user can view all positions (not just their own)
 */
export const canViewAllPositions = (permissions: string[] | undefined): boolean => {
    return hasPermission(permissions, 'positions:read_all');
};

/**
 * Check if user can manage risk
 */
export const canManageRisk = (permissions: string[] | undefined): boolean => {
    return hasPermission(permissions, 'risk:manage');
};

/**
 * Check if user can view market data
 */
export const canViewMarketData = (permissions: string[] | undefined): boolean => {
    return hasPermission(permissions, ['market:read', 'market:subscribe']);
};

/**
 * Check if user can manage accounts
 */
export const canManageAccounts = (permissions: string[] | undefined): boolean => {
    return hasPermission(permissions, ['accounts:create', 'accounts:update', 'accounts:delete']);
};

/**
 * Check if user can execute strategies
 */
export const canExecuteStrategies = (permissions: string[] | undefined): boolean => {
    return hasPermission(permissions, 'strategies:execute');
};

// =============================================================================
// ROLE CHECKERS
// =============================================================================

/**
 * Check if user is admin
 */
export const isAdmin = (role: string | undefined): boolean => {
    return role === 'admin';
};

/**
 * Check if user is trader
 */
export const isTrader = (role: string | undefined): boolean => {
    return role === 'trader';
};

/**
 * Check if user is viewer
 */
export const isViewer = (role: string | undefined): boolean => {
    return role === 'viewer';
};

/**
 * Check if user is risk manager
 */
export const isRiskManager = (role: string | undefined): boolean => {
    return role === 'risk_manager';
};

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Get display name for a role
 */
export const getRoleDisplayName = (role: string | undefined): string => {
    const roleNames: Record<string, string> = {
        admin: 'Administrator',
        trader: 'Trader',
        viewer: 'Viewer',
        risk_manager: 'Risk Manager',
        system: 'System',
    };
    return roleNames[role || ''] || role || 'Unknown';
};

/**
 * Get badge color for a role
 */
export const getRoleBadgeColor = (role: string | undefined): string => {
    const colors: Record<string, string> = {
        admin: 'bg-red-600',
        trader: 'bg-blue-600',
        viewer: 'bg-gray-600',
        risk_manager: 'bg-yellow-600',
        system: 'bg-purple-600',
    };
    return colors[role || ''] || 'bg-gray-600';
};