export const actions = ['view', 'write', 'post', 'delete'] as const;
export type PermissionAction = (typeof actions)[number];

export const permissionModules = {
  sales: 'Sales & Invoices',
  purchases: 'Purchases & Bills',
  banking: 'Banking & Treasury',
  inventory: 'Inventory & Stock',
  reports: 'Financial Reports',
  settings: 'Store Settings',
  orders: 'Online Orders',
} as const;

export type PermissionModule = keyof typeof permissionModules;

export const moduleActions: Record<PermissionModule, readonly PermissionAction[]> = {
  sales: ['view', 'write', 'post', 'delete'],
  purchases: ['view', 'write', 'post', 'delete'],
  banking: ['view', 'write', 'post', 'delete'],
  inventory: ['view', 'write', 'post', 'delete'],
  reports: ['view'],
  settings: ['view', 'write'],
  orders: ['view', 'write', 'post', 'delete'],
};

export type Permissions = Partial<Record<PermissionModule, PermissionAction[]>>;

export const permissionPresets: Record<string, Permissions> = {
  'Full administrator': {
    sales: ['view', 'write', 'post', 'delete'],
    purchases: ['view', 'write', 'post', 'delete'],
    banking: ['view', 'write', 'post', 'delete'],
    inventory: ['view', 'write', 'post', 'delete'],
    reports: ['view'],
    settings: ['view', 'write'],
    orders: ['view', 'write', 'post', 'delete'],
  },
  'Accountant': {
    sales: ['view', 'write', 'post'],
    purchases: ['view', 'write', 'post'],
    banking: ['view', 'write', 'post'],
    reports: ['view'],
    inventory: ['view'],
    settings: ['view'],
    orders: ['view'],
  },
  'Sales staff': {
    sales: ['view', 'write'],
    orders: ['view', 'write'],
    inventory: ['view'],
    reports: ['view'],
    banking: [],
    purchases: [],
    settings: [],
  },
  'Warehouse staff': {
    inventory: ['view', 'write', 'post'],
    purchases: ['view', 'write'],
    orders: ['view'],
    sales: [],
    banking: [],
    reports: [],
    settings: [],
  },
  'Read only': {
    sales: ['view'],
    purchases: ['view'],
    banking: ['view'],
    inventory: ['view'],
    reports: ['view'],
    settings: ['view'],
    orders: ['view'],
  },
};

export function can(
  user: any,
  module: PermissionModule | string,
  action: PermissionAction | string = 'view'
): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  if (user.role !== 'admin') return false;

  const userPerms = user.permissions;
  if (!userPerms || typeof userPerms !== 'object') {
    return false;
  }

  const modulePerms = userPerms[module as PermissionModule];
  if (!Array.isArray(modulePerms)) return false;

  return modulePerms.includes(action as PermissionAction);
}

export function routeModule(pathname: string): PermissionModule | null {
  const p = pathname.toLowerCase();
  if (p.includes('/sales') || p.includes('/customer')) return 'sales';
  if (p.includes('/purchase') || p.includes('/vendor')) return 'purchases';
  if (p.includes('/bank') || p.includes('/voucher') || p.includes('/treasury')) return 'banking';
  if (p.includes('/orders') || p.includes('/order')) return 'orders';
  if (p.includes('/inventory') || p.includes('/products') || p.includes('/categories')) return 'inventory';
  if (p.includes('/reports') || p.includes('/ledger') || p.includes('/analytics')) return 'reports';
  if (p.includes('/settings') || p.includes('/config')) return 'settings';
  return null;
}

export function normalizePermissions(raw: any): Permissions {
  if (!raw || typeof raw !== 'object') return {};
  const normalized: Permissions = {};
  for (const mod of Object.keys(permissionModules) as PermissionModule[]) {
    if (Array.isArray(raw[mod])) {
      const allowed = moduleActions[mod] || [];
      normalized[mod] = raw[mod].filter((a: any) => allowed.includes(a));
    }
  }
  return normalized;
}
