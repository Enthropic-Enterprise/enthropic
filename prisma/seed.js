const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding roles & permissions...');

    // Permissions
    const permissions = [
        // Market
        { name: 'market:read', resource: 'market', action: 'read' },

        // Positions
        { name: 'positions:read', resource: 'positions', action: 'read' },
        { name: 'positions:read_all', resource: 'positions', action: 'read_all' },

        // Orders
        { name: 'orders:create', resource: 'orders', action: 'create' },
        { name: 'orders:read', resource: 'orders', action: 'read' },
        { name: 'orders:read_all', resource: 'orders', action: 'read_all' },
        { name: 'orders:cancel', resource: 'orders', action: 'cancel' },

        // Risk
        { name: 'risk:read', resource: 'risk', action: 'read' },
        { name: 'risk:manage', resource: 'risk', action: 'manage' },

        // Admin
        { name: 'admin:full', resource: 'admin', action: 'full' },
    ];

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
    }

    console.log(`✔ ${permissions.length} permissions seeded`);

    // Roles
    const roles = [
        { name: 'viewer', description: 'Read-only access (no trading)' },
        { name: 'trader', description: 'Can trade and view own data' },
        { name: 'risk_manager', description: 'Can manage risk and view all positions' },
        { name: 'admin', description: 'Full system access' },
    ];

    for (const role of roles) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: role,
        });
    }

    console.log(`${roles.length} roles seeded`);

    // Roles - Permission Mapping
    const rolePermissions = {
        viewer: [
            'market:read',
        ],

        trader: [
            'market:read',
            'positions:read',
            'orders:create',
            'orders:read',
            'orders:cancel',
        ],

        risk_manager: [
            'market:read',
            'positions:read',
            'positions:read_all',
            'orders:read',
            'orders:read_all',
            'risk:read',
            'risk:manage',
        ],

        admin: permissions.map(p => p.name),
    };

    for (const [roleName, permNames] of Object.entries(rolePermissions)) {
        const role = await prisma.role.findUnique({
            where: { name: roleName },
        });

        if (!role) {
            console.warn(`Role not found: ${roleName}`);
            continue;
        }

        for (const permName of permNames) {
            const permission = await prisma.permission.findUnique({
                where: { name: permName },
            });

            if (!permission) {
                console.warn(`Permission not found: ${permName}`);
                continue;
            }

            await prisma.rolePermission.upsert({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id,
                    },
                },
                update: {},
                create: {
                    roleId: role.id,
                    permissionId: permission.id,
                },
            });
        }
    }

    console.log('Role → permission mapping completed');
    console.log('Seed completed successfully');
}

// Run
main()
    .catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
