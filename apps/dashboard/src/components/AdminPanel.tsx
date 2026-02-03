// =============================================================================
// Admin Panel with Interactive Modals
// File: apps/dashboard/src/components/AdminPanel.tsx
// =============================================================================

import React, { useState, useEffect } from 'react';

interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLoginAt?: string;
    createdAt: string;
}

interface AuditLog {
    id: string;
    accountId: string;
    username: string;
    eventType: string;
    eventData: any;
    ipAddress: string;
    success: boolean;
    createdAt: string;
}

interface SystemConfig {
    key: string;
    value: string;
    description: string;
    category: string;
}

export function AdminPanel() {
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [systemConfig, setSystemConfig] = useState<SystemConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Mock data - in production, fetch from API
    useEffect(() => {
        // Mock users
        setUsers([
            { id: '1', username: 'admin', email: 'admin@enthropic.io', role: 'admin', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2024-01-01T00:00:00Z' },
            { id: '2', username: 'trader1', email: 'trader1@enthropic.io', role: 'trader', isActive: true, lastLoginAt: new Date(Date.now() - 3600000).toISOString(), createdAt: '2024-01-15T00:00:00Z' },
            { id: '3', username: 'trader2', email: 'trader2@enthropic.io', role: 'trader', isActive: true, lastLoginAt: new Date(Date.now() - 86400000).toISOString(), createdAt: '2024-02-01T00:00:00Z' },
            { id: '4', username: 'viewer1', email: 'viewer1@enthropic.io', role: 'viewer', isActive: true, lastLoginAt: new Date(Date.now() - 172800000).toISOString(), createdAt: '2024-02-15T00:00:00Z' },
            { id: '5', username: 'riskmanager', email: 'risk@enthropic.io', role: 'risk_manager', isActive: true, lastLoginAt: new Date(Date.now() - 7200000).toISOString(), createdAt: '2024-03-01T00:00:00Z' },
            { id: '6', username: 'suspended_user', email: 'suspended@enthropic.io', role: 'trader', isActive: false, createdAt: '2024-01-20T00:00:00Z' },
        ]);

        // Mock audit logs
        setAuditLogs([
            { id: '1', accountId: '1', username: 'admin', eventType: 'LOGIN', eventData: {}, ipAddress: '192.168.1.1', success: true, createdAt: new Date().toISOString() },
            { id: '2', accountId: '2', username: 'trader1', eventType: 'ORDER_SUBMIT', eventData: { symbol: 'BTC-USD', side: 'buy' }, ipAddress: '192.168.1.2', success: true, createdAt: new Date(Date.now() - 60000).toISOString() },
            { id: '3', accountId: '3', username: 'trader2', eventType: 'ORDER_CANCEL', eventData: { orderId: 'abc123' }, ipAddress: '192.168.1.3', success: true, createdAt: new Date(Date.now() - 120000).toISOString() },
            { id: '4', accountId: '4', username: 'viewer1', eventType: 'LOGIN', eventData: {}, ipAddress: '192.168.1.4', success: false, createdAt: new Date(Date.now() - 180000).toISOString() },
            { id: '5', accountId: '1', username: 'admin', eventType: 'USER_UPDATE', eventData: { userId: '6', action: 'suspend' }, ipAddress: '192.168.1.1', success: true, createdAt: new Date(Date.now() - 240000).toISOString() },
        ]);

        // Mock system config
        setSystemConfig([
            { key: 'MARKET_OPEN_TIME', value: '09:00', description: 'Market opening time (IDX)', category: 'Trading' },
            { key: 'MARKET_CLOSE_TIME', value: '16:00', description: 'Market closing time (IDX)', category: 'Trading' },
            { key: 'MAX_ORDER_VALUE', value: '1000000', description: 'Maximum order value in IDR', category: 'Risk' },
            { key: 'RATE_LIMIT_ORDERS', value: '100', description: 'Max orders per minute', category: 'System' },
            { key: 'MAINTENANCE_MODE', value: 'false', description: 'Enable maintenance mode', category: 'System' },
            { key: 'FIX_GATEWAY_HOST', value: 'fix.idx.co.id', description: 'IDX FIX gateway hostname', category: 'Connectivity' },
        ]);
    }, []);

    const getRoleBadge = (role: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-red-500/20 text-red-400 border-red-500/30',
            trader: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
            risk_manager: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        };
        return colors[role] || colors.viewer;
    };

    const getEventBadge = (eventType: string, success: boolean) => {
        if (!success) return 'bg-red-500/20 text-red-400';

        const colors: Record<string, string> = {
            LOGIN: 'bg-green-500/20 text-green-400',
            LOGOUT: 'bg-gray-500/20 text-gray-400',
            ORDER_SUBMIT: 'bg-blue-500/20 text-blue-400',
            ORDER_CANCEL: 'bg-yellow-500/20 text-yellow-400',
            USER_UPDATE: 'bg-purple-500/20 text-purple-400',
        };
        return colors[eventType] || 'bg-gray-500/20 text-gray-400';
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const toggleUserStatus = async (userId: string) => {
        setUsers(users.map(u =>
            u.id === userId ? { ...u, isActive: !u.isActive } : u
        ));
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                </svg>
                Admin Panel
            </h3>

            <div className="space-y-2 text-sm">
                {/* Manage Users Button */}
                <button
                    onClick={() => setActiveModal('users')}
                    className="w-full px-3 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 text-left flex justify-between items-center"
                >
                    <span>Manage Users</span>
                    <span className="bg-red-500/30 px-2 py-0.5 rounded text-xs">{users.length}</span>
                </button>

                {/* System Config Button */}
                <button
                    onClick={() => setActiveModal('config')}
                    className="w-full px-3 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 text-left flex justify-between items-center"
                >
                    <span>System Config</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* View Audit Logs Button */}
                <button
                    onClick={() => setActiveModal('audit')}
                    className="w-full px-3 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 text-left flex justify-between items-center"
                >
                    <span>View Audit Logs</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Users Modal */}
            {activeModal === 'users' && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white">User Management</h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4">
                            {/* Search */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Users Table */}
                            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-800">
                                    <tr className="text-gray-400 border-b border-gray-700">
                                        <th className="text-left py-3 px-3 font-medium">User</th>
                                        <th className="text-left py-3 px-3 font-medium">Role</th>
                                        <th className="text-left py-3 px-3 font-medium">Status</th>
                                        <th className="text-left py-3 px-3 font-medium">Last Login</th>
                                        <th className="text-right py-3 px-3 font-medium">Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                            <td className="py-3 px-3">
                                                <div>
                                                    <span className="text-white font-medium">{user.username}</span>
                                                    <p className="text-gray-500 text-xs">{user.email}</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                          <span className={`px-2 py-1 rounded text-xs border ${getRoleBadge(user.role)}`}>
                            {user.role.replace('_', ' ')}
                          </span>
                                            </td>
                                            <td className="py-3 px-3">
                          <span className={`px-2 py-1 rounded text-xs ${user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {user.isActive ? 'Active' : 'Suspended'}
                          </span>
                                            </td>
                                            <td className="py-3 px-3 text-gray-400">
                                                {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <button
                                                    onClick={() => toggleUserStatus(user.id)}
                                                    className={`px-3 py-1 rounded text-xs ${
                                                        user.isActive
                                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                    }`}
                                                >
                                                    {user.isActive ? 'Suspend' : 'Activate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* System Config Modal */}
            {activeModal === 'config' && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white">System Configuration</h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {/* Group by category */}
                            {['Trading', 'Risk', 'System', 'Connectivity'].map(category => {
                                const configs = systemConfig.filter(c => c.category === category);
                                if (configs.length === 0) return null;

                                return (
                                    <div key={category} className="mb-6">
                                        <h3 className="text-white font-medium mb-3 flex items-center">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                            {category}
                                        </h3>
                                        <div className="space-y-3">
                                            {configs.map(config => (
                                                <div key={config.key} className="bg-gray-700/50 rounded-lg p-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <label className="text-gray-300 text-sm font-medium">{config.key}</label>
                                                            <p className="text-gray-500 text-xs mt-0.5">{config.description}</p>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={config.value}
                                                            onChange={(e) => {
                                                                setSystemConfig(systemConfig.map(c =>
                                                                    c.key === config.key ? { ...c, value: e.target.value } : c
                                                                ));
                                                            }}
                                                            className="ml-4 w-40 px-3 py-1.5 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mt-4">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Audit Logs Modal */}
            {activeModal === 'audit' && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[85vh] overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white">Audit Logs</h2>
                            <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[65vh]">
                            <div className="space-y-2">
                                {auditLogs.map(log => (
                                    <div key={log.id} className="bg-gray-700/50 rounded-lg p-3 flex justify-between items-center">
                                        <div className="flex items-center space-x-3">
                                            <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-white font-medium">{log.username}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${getEventBadge(log.eventType, log.success)}`}>
                            {log.eventType.replace('_', ' ')}
                          </span>
                                                </div>
                                                <p className="text-gray-500 text-xs">
                                                    IP: {log.ipAddress}
                                                    {log.eventData && Object.keys(log.eventData).length > 0 && (
                                                        <span className="ml-2">• {JSON.stringify(log.eventData)}</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-gray-400 text-sm">{formatDate(log.createdAt)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}