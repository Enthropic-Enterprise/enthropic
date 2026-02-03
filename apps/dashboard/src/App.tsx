// =============================================================================
// Enthropic Trading Platform - Main App with Full Features
// File: apps/dashboard/src/App.tsx
// =============================================================================

import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useNatsWebSocket } from './hooks/useNatsWebSocket';
import { Login } from './components/Login';
import { PositionsTable } from './components/PositionsTable';
import { OrderStatus } from './components/OrderStatus';
import { MarketDataPanel } from './components/MarketDataPanel';
import { PnLChart } from './components/PnLChart';
import { RiskManagementPanel } from './components/RiskManagementPanel';
import { AdminPanel } from './components/AdminPanel';
import {
    PermissionGate,
    RoleGate,
    RoleBadge,
    AccessDenied,
    LockedFeature,
} from './components/RBAC';
import {
    canTrade,
    canViewAllPositions,
    canManageRisk,
    isAdmin,
    isViewer,
    isRiskManager,
} from './utils/permissions';

// =============================================================================
// DASHBOARD COMPONENT
// =============================================================================

function Dashboard() {
    const { user, logout } = useAuth();
    const {
        connected,
        authenticated,
        positions,
        orders,
        marketTicks,
        subscribe,
        submitOrder,
        cancelOrder,
    } = useNatsWebSocket();

    // Auto-subscribe on authentication
    useEffect(() => {
        if (authenticated && user) {
            // Subscribe to market data
            subscribe('market.ticks');

            // Subscribe to user-specific channels
            if (user.permissions.includes('positions:read') || user.permissions.includes('positions:read_all')) {
                subscribe(`positions.${user.id}`);
                if (user.permissions.includes('positions:read_all')) {
                    subscribe('positions.*');
                }
            }

            if (user.permissions.includes('orders:read') || user.permissions.includes('orders:read_all')) {
                subscribe(`orders.${user.id}`);
                if (user.permissions.includes('orders:read_all')) {
                    subscribe('orders.all');
                }
            }
        }
    }, [authenticated, user, subscribe]);

    // Filter data based on role
    const filteredPositions = canViewAllPositions(user?.permissions)
        ? positions
        : positions.filter((p) => p.accountId === user?.id);

    const filteredOrders = user?.permissions.includes('orders:read_all')
        ? orders
        : orders.filter((o) => o.accountId === user?.id);

    const userCanTrade = canTrade(user?.permissions);
    const userIsViewer = isViewer(user?.role);
    const userIsAdmin = isAdmin(user?.role);
    const userIsRiskManager = isRiskManager(user?.role);

    const handleEmergencyStop = () => {
        // Cancel all pending orders
        filteredOrders
            .filter(o => ['pending', 'accepted', 'partially_filled'].includes(o.status))
            .forEach(o => cancelOrder(o.id));
    };

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-xl font-bold text-white">Enthropic Trading</h1>
                        <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                            <span className="text-sm text-gray-400">
                {connected ? (authenticated ? 'Connected' : 'Authenticating...') : 'Disconnected'}
              </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <span className="text-gray-400">{user?.username}</span>
                            <RoleBadge role={user?.role} size="sm" />
                        </div>
                        <button
                            onClick={logout}
                            className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Role-specific Banner */}
            {userIsViewer && (
                <div className="bg-yellow-600/20 border-b border-yellow-600/30 px-4 py-2">
                    <p className="text-yellow-400 text-sm text-center">
                        👁️ <strong>View Only Mode</strong> - You can only view market data. Trading features are disabled.
                    </p>
                </div>
            )}

            {userIsRiskManager && (
                <div className="bg-blue-600/20 border-b border-blue-600/30 px-4 py-2">
                    <p className="text-blue-400 text-sm text-center">
                        📊 <strong>Risk Manager Mode</strong> - You can view all positions and manage risk limits. Trading is disabled.
                    </p>
                </div>
            )}

            {/* Main Content */}
            <main className="p-4">
                <div className="grid grid-cols-12 gap-4">
                    {/* LEFT COLUMN - Market Data & Order Entry */}
                    <div className="col-span-3 space-y-4">
                        {/* Market Data Panel */}
                        <MarketDataPanel ticks={marketTicks} onSubscribe={subscribe} />

                        {/* Order Entry */}
                        {userCanTrade ? (
                            <OrderStatus
                                orders={filteredOrders}
                                onSubmitOrder={submitOrder}
                                onCancelOrder={cancelOrder}
                            />
                        ) : (
                            <LockedFeature message="Trading not available for your role">
                                <div className="bg-gray-800 rounded-lg p-4">
                                    <h2 className="text-lg font-semibold text-white mb-4">Order Entry</h2>
                                    <div className="space-y-3">
                                        <div className="bg-gray-700 h-10 rounded"></div>
                                        <div className="bg-gray-700 h-10 rounded"></div>
                                        <div className="bg-gray-700 h-10 rounded"></div>
                                        <div className="bg-green-600 h-10 rounded"></div>
                                    </div>
                                </div>
                            </LockedFeature>
                        )}
                    </div>

                    {/* CENTER COLUMN - P&L Chart & Positions */}
                    <div className="col-span-6 space-y-4">
                        {/* P&L Chart */}
                        <PermissionGate
                            permission="positions:read"
                            fallback={
                                <div className="bg-gray-800 rounded-lg p-8">
                                    <AccessDenied message="P&L data is not available for viewers" />
                                </div>
                            }
                        >
                            <PnLChart positions={filteredPositions} />
                        </PermissionGate>

                        {/* Positions Table */}
                        <PermissionGate
                            permission={['positions:read', 'positions:read_all']}
                            fallback={
                                <div className="bg-gray-800 rounded-lg p-8">
                                    <AccessDenied message="Position data is not available for viewers" />
                                </div>
                            }
                        >
                            <PositionsTable
                                positions={filteredPositions}
                                showAllAccounts={canViewAllPositions(user?.permissions)}
                            />
                        </PermissionGate>
                    </div>

                    {/* RIGHT COLUMN - Account Info & Admin */}
                    <div className="col-span-3 space-y-4">
                        {/* Account Info */}
                        <div className="bg-gray-800 rounded-lg p-4">
                            <h2 className="text-lg font-semibold text-white mb-4">Account Info</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Username:</span>
                                    <span className="text-white">{user?.username}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Role:</span>
                                    <RoleBadge role={user?.role} size="sm" />
                                </div>

                                <PermissionGate permission="positions:read">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Positions:</span>
                                        <span className="text-white">{filteredPositions.length}</span>
                                    </div>
                                </PermissionGate>

                                <PermissionGate permission="orders:read">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Open Orders:</span>
                                        <span className="text-white">
                      {filteredOrders.filter((o) => ['pending', 'accepted', 'partially_filled'].includes(o.status)).length}
                    </span>
                                    </div>
                                </PermissionGate>
                            </div>

                            {/* Permissions List */}
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <h3 className="text-sm font-medium text-white mb-2">Your Permissions</h3>
                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                    {user?.permissions.map((perm) => (
                                        <span key={perm} className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                      {perm}
                    </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Feature Access Card */}
                        <div className="bg-gray-800 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-white mb-3">Feature Access</h3>
                            <div className="space-y-2 text-xs">
                                <FeatureAccessItem label="View Market Data" enabled={true} />
                                <FeatureAccessItem label="Trading" enabled={userCanTrade} />
                                <FeatureAccessItem label="View Positions" enabled={!userIsViewer} />
                                <FeatureAccessItem label="View All Positions" enabled={canViewAllPositions(user?.permissions)} />
                                <FeatureAccessItem label="Manage Risk" enabled={canManageRisk(user?.permissions)} />
                                <FeatureAccessItem label="Admin Panel" enabled={userIsAdmin} />
                            </div>
                        </div>

                        {/* Risk Manager Panel */}
                        <RoleGate roles={['admin', 'risk_manager']}>
                            <RiskManagementPanel
                                positions={filteredPositions}
                                onEmergencyStop={handleEmergencyStop}
                            />
                        </RoleGate>

                        {/* Admin Panel */}
                        <RoleGate roles="admin">
                            <AdminPanel />
                        </RoleGate>
                    </div>
                </div>
            </main>
        </div>
    );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function FeatureAccessItem({ label, enabled }: { label: string; enabled: boolean }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-gray-400">{label}</span>
            {enabled ? (
                <span className="text-green-400 flex items-center">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </span>
            ) : (
                <span className="text-red-400 flex items-center">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
            )}
        </div>
    );
}

// =============================================================================
// MAIN APP
// =============================================================================

function App() {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Login />;
    }

    return <Dashboard />;
}

export default App;