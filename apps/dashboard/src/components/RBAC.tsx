// =============================================================================
// Role-Based Access Control (RBAC) Components
// File: apps/dashboard/src/components/RBAC.tsx
// =============================================================================
// Components for conditional rendering based on user roles and permissions
// =============================================================================

import React from 'react';
import { useAuth } from '../hooks/useAuth';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type Permission = string;
type Role = 'admin' | 'trader' | 'viewer' | 'risk_manager' | 'system' | string;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const hasPermission = (userPermissions: string[] | undefined, required: Permission | Permission[]): boolean => {
    if (!userPermissions || userPermissions.length === 0) return false;

    // Admin full access
    if (userPermissions.includes('admin:full')) return true;

    const permissions = Array.isArray(required) ? required : [required];
    return permissions.some(p => userPermissions.includes(p));
};

const hasAllPermissions = (userPermissions: string[] | undefined, required: Permission[]): boolean => {
    if (!userPermissions || userPermissions.length === 0) return false;
    if (userPermissions.includes('admin:full')) return true;
    return required.every(p => userPermissions.includes(p));
};

// =============================================================================
// PERMISSION GATE - Show content only if user has required permission
// =============================================================================

interface PermissionGateProps {
    permission: Permission | Permission[];
    requireAll?: boolean;
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

export function PermissionGate({
                                   permission,
                                   requireAll = false,
                                   fallback = null,
                                   children,
                               }: PermissionGateProps) {
    const { user } = useAuth();

    const permissions = Array.isArray(permission) ? permission : [permission];

    const hasAccess = requireAll
        ? hasAllPermissions(user?.permissions, permissions)
        : hasPermission(user?.permissions, permission);

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// =============================================================================
// ROLE GATE - Show content only if user has specific role
// =============================================================================

interface RoleGateProps {
    roles: Role | Role[];
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

export function RoleGate({ roles, fallback = null, children }: RoleGateProps) {
    const { user } = useAuth();

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    const hasAccess = user?.role ? allowedRoles.includes(user.role) : false;

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// =============================================================================
// ROLE BADGE - Display role with color
// =============================================================================

interface RoleBadgeProps {
    role?: string;
    size?: 'sm' | 'md' | 'lg';
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-600' },
    trader: { label: 'Trader', color: 'bg-blue-600' },
    viewer: { label: 'Viewer', color: 'bg-gray-600' },
    risk_manager: { label: 'Risk Manager', color: 'bg-yellow-600' },
    system: { label: 'System', color: 'bg-purple-600' },
};

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
    const config = role ? ROLE_CONFIG[role] : null;
    const displayName = config?.label || role || 'Unknown';
    const color = config?.color || 'bg-gray-600';

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
    };

    return (
        <span className={`${color} text-white rounded-full font-medium ${sizeClasses[size]}`}>
      {displayName}
    </span>
    );
}

// =============================================================================
// ACCESS DENIED - Display when user doesn't have access
// =============================================================================

interface AccessDeniedProps {
    message?: string;
    icon?: boolean;
}

export function AccessDenied({
                                 message = "You don't have permission to access this feature.",
                                 icon = true,
                             }: AccessDeniedProps) {
    return (
        <div className="flex flex-col items-center justify-center p-6 bg-gray-800/50 rounded-lg border border-gray-700">
            {icon && (
                <div className="w-12 h-12 mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                    </svg>
                </div>
            )}
            <p className="text-gray-400 text-sm text-center">{message}</p>
        </div>
    );
}

// =============================================================================
// LOCKED FEATURE - Display locked overlay on disabled features
// =============================================================================

interface LockedFeatureProps {
    message?: string;
    children: React.ReactNode;
}

export function LockedFeature({
                                  message = 'This feature is not available for your role',
                                  children,
                              }: LockedFeatureProps) {
    return (
        <div className="relative">
            <div className="opacity-30 pointer-events-none">{children}</div>
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm rounded-lg">
                <div className="text-center p-4">
                    <svg className="w-8 h-8 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                    </svg>
                    <p className="text-gray-400 text-sm">{message}</p>
                </div>
            </div>
        </div>
    );
}