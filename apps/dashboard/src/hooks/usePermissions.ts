// =============================================================================
// Role-Based Access Control (RBAC) Utilities
// File: apps/dashboard/src/hooks/usePermissions.ts
// =============================================================================

import { useAuth } from './useAuth';
import { useMemo } from 'react';

// =============================================================================
// ROLE DEFINITIONS
// =============================================================================

export type Role = 'admin' | 'trader' | 'viewer' | 'risk_manager' | 'system';

export const ROLES: Record<Role, { label: string; color: string; description: string }> = {
    admin: {
        label: 'Administrator',
        color: 'bg-red-500',
        description: 'Full system access',
    },
    trader: {
        label: 'Trader',
        color: 'bg-blue-500',
        description: 'Trading and market data access',
    },
    viewer: {
        label: 'Viewer',
        color: 'bg-gray-500',
        description: 'Read-only market data access',
    },
    risk_manager: {
        label: 'Risk Manager',
        color: 'bg-yellow-500',
        description: 'Risk monitoring and management',
    },
    system: {
        label: 'System',
        color: 'bg-purple-500',
        description: 'Internal system operations',
    },
};

// =============================================================================
// PERMISSION DEFINITIONS
// =============================================================================

export const PERMISSIONS = {
    // Orders
    ORDERS_CREATE: 'orders:create',
    ORDERS_READ: 'orders:read',
    ORDERS_CANCEL: 'orders:cancel',
    ORDERS_READ_ALL: 'orders:read_all',

    // Positions
    POSITIONS_READ: 'positions:read',
    POSITIONS_READ_ALL: 'positions:read_all',

    // Market
    MARKET_READ: 'market:read',
    MARKET_SUBSCRIBE: 'market:subscribe',

    // Accounts
    ACCOUNTS_READ: 'accounts:read',
    ACCOUNTS_READ_ALL: 'accounts:read_all',
    ACCOUNTS_CREATE: 'accounts:create',
    ACCOUNTS_UPDATE: 'accounts:update',
    ACCOUNTS_DELETE: 'accounts:delete',

    // Risk
    RISK_READ: 'risk:read',
    RISK_MANAGE: 'risk:manage',

    // Strategies
    STRATEGIES_READ: 'strategies:read',
    STRATEGIES_CREATE: 'strategies:create',
    STRATEGIES_EXECUTE: 'strategies:execute',

    // Admin
    ADMIN_FULL: 'admin:full',
    SYSTEM_INTERNAL: 'system:internal',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// =============================================================================
// FEATURE FLAGS BY ROLE
// =============================================================================

export interface FeatureFlags {
    canTrade: boolean;
    canViewMarketData: boolean;
    canViewPositions: boolean;
    canViewAllPositions: boolean;
    canViewOrders: boolean;
    canViewAllOrders: boolean;
    canCancelOrders: boolean;
    canManageRisk: boolean;
    canManageAccounts: boolean;
    canManageStrategies: boolean;
    canAccessAdmin: boolean;
    canViewPnL: boolean;
    canExportData: boolean;
}

const ROLE_FEATURES: Record<Role, FeatureFlags> = {
    admin: {
        canTrade: true,
        canViewMarketData: true,
        canViewPositions: true,
        canViewAllPositions: true,
        canViewOrders: true,
        canViewAllOrders: true,
        canCancelOrders: true,
        canManageRisk: true,
        canManageAccounts: true,
        canManageStrategies: true,
        canAccessAdmin: true,
        canViewPnL: true,
        canExportData: true,
    },
    trader: {
        canTrade: true,
        canViewMarketData: true,
        canViewPositions: true,
        canViewAllPositions: false,
        canViewOrders: true,
        canViewAllOrders: false,
        canCancelOrders: true,
        canManageRisk: false,
        canManageAccounts: false,
        canManageStrategies: false,
        canAccessAdmin: false,
        canViewPnL: true,
        canExportData: false,
    },
    viewer: {
        canTrade: false,
        canViewMarketData: true,
        canViewPositions: false,
        canViewAllPositions: false,
        canViewOrders: false,
        canViewAllOrders: false,
        canCancelOrders: false,
        canManageRisk: false,
        canManageAccounts: false,
        canManageStrategies: false,
        canAccessAdmin: false,
        canViewPnL: false,
        canExportData: false,
    },
    risk_manager: {
        canTrade: false,
        canViewMarketData: true,
        canViewPositions: true,
        canViewAllPositions: true,
        canViewOrders: true,
        canViewAllOrders: true,
        canCancelOrders: false,
        canManageRisk: true,
        canManageAccounts: false,
        canManageStrategies: false,
        canAccessAdmin: false,
        canViewPnL: true,
        canExportData: true,
    },
    system: {
        canTrade: false,
        canViewMarketData: false,
        canViewPositions: false,
        canViewAllPositions: false,
        canViewOrders: false,
        canViewAllOrders: false,
        canCancelOrders: false,
        canManageRisk: false,
        canManageAccounts: false,
        canManageStrategies: false,
        canAccessAdmin: false,
        canViewPnL: false,
        canExportData: false,
    },
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to check user permissions
 */
export function usePermissions() {
    const { user } = useAuth();

    const permissions = useMemo(() => {
        return new Set(user?.permissions || []);
    }, [user?.permissions]);

    const role = useMemo(() => {
        return (user?.role || 'viewer') as Role;
    }, [user?.role]);

    const features = useMemo(() => {
        return ROLE_FEATURES[role] || ROLE_FEATURES.viewer;
    }, [role]);

    const hasPermission = (permission: Permission): boolean => {
        return permissions.has(permission) || permissions.has(PERMISSIONS.ADMIN_FULL);
    };

    const hasAnyPermission = (...perms: Permission[]): boolean => {
        return perms.some(p => hasPermission(p));
    };

    const hasAllPermissions = (...perms: Permission[]): boolean => {
        return perms.every(p => hasPermission(p));
    };

    const isRole = (r: Role): boolean => {
        return role === r;
    };

    const isAnyRole = (...roles: Role[]): boolean => {
        return roles.includes(role);
    };

    return {
        permissions,
        role,
        features,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isRole,
        isAnyRole,
        isAdmin: role === 'admin',
        isTrader: role === 'trader',
        isViewer: role === 'viewer',
        isRiskManager: role === 'risk_manager',
        roleInfo: ROLES[role],
    };
}

/**
 * Hook for feature flags
 */
export function useFeatureFlags(): FeatureFlags {
    const { features } = usePermissions();
    return features;
}