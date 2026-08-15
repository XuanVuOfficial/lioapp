import { queryDB, escapeSQL, subscribeDB, executeMutation } from '../api';

const DOC_ID = 'app_settings';

export interface AppSettings {
  tabVisibility: Record<string, string[]>; // role -> list of tab IDs
  roleLimits?: {
    tgd: number | null;
    admin: number | null;
    gds: number | null;
    tp: number | null;
    staff: number | null;
  };
  lockPermissions?: {
    admin?: boolean;
    tp?: boolean;
    gds?: boolean;
    [role: string]: boolean | undefined;
  };
  zaloGroupId?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  tabVisibility: {
    tgd: ['dashboard', 'leads', 'projects', 'departments', 'staff', 'settings'],
    admin: ['dashboard', 'leads', 'projects', 'departments', 'staff', 'settings'],
    gds: ['dashboard', 'leads', 'projects', 'departments', 'staff'],
    tp: ['dashboard', 'leads', 'projects', 'departments', 'staff'],
    staff: ['dashboard', 'leads']
  },
  roleLimits: {
    tgd: null,
    admin: null,
    gds: null,
    tp: null,
    staff: null
  },
  lockPermissions: {
    admin: true,
    tp: false,
    gds: false
  },
  zaloGroupId: '4814904778699793764'
};

const parseSettings = (row: any): AppSettings => {
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  if (row.tabVisibility) {
    try {
      settings.tabVisibility = typeof row.tabVisibility === 'string' ? JSON.parse(row.tabVisibility) : row.tabVisibility;
    } catch (e) { }
  }
  if (row.roleLimits) {
    try {
      settings.roleLimits = typeof row.roleLimits === 'string' ? JSON.parse(row.roleLimits) : row.roleLimits;
    } catch (e) { }
  }
  if (row.lockPermissions) {
    try {
      settings.lockPermissions = typeof row.lockPermissions === 'string' ? JSON.parse(row.lockPermissions) : row.lockPermissions;
    } catch (e) { }
  } else {
    settings.lockPermissions = {
      admin: true,
      tp: false,
      gds: false
    };
  }
  if (row.zaloGroupId) {
    settings.zaloGroupId = String(row.zaloGroupId).trim();
  }
  return settings;
};

let hasEnsuredLockColumn = false;
const ensureLockColumn = async () => {
  if (hasEnsuredLockColumn) return;
  try {
    await queryDB(`ALTER TABLE settings ADD COLUMN lockPermissions JSON`);
  } catch (e) {
    // Column may already exist, ignore error
  }
  hasEnsuredLockColumn = true;
};

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    await ensureLockColumn();
    const data = await queryDB(`SELECT * FROM settings WHERE id = ${escapeSQL(DOC_ID)} LIMIT 1`);
    if (data && data.length > 0) {
      return parseSettings(data[0]);
    }

    // Initialize with defaults if not exists
    await updateAppSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (e) {
    console.error('getAppSettings error', e);
    return DEFAULT_SETTINGS;
  }
};

export const updateAppSettings = async (settings: AppSettings): Promise<void> => {
  await ensureLockColumn();
  const zaloGroup = settings.zaloGroupId ? settings.zaloGroupId.trim() : '4814904778699793764';
  const lockPerms = settings.lockPermissions || { admin: true, tp: false, gds: false };
  await executeMutation(
    'settings',
    'UPDATE',
    settings,
    `INSERT INTO settings (id, tabVisibility, roleLimits, zaloGroupId, lockPermissions) VALUES (${escapeSQL(DOC_ID)}, ${escapeSQL(settings.tabVisibility)}, ${escapeSQL(settings.roleLimits)}, ${escapeSQL(zaloGroup)}, ${escapeSQL(lockPerms)}) ON DUPLICATE KEY UPDATE tabVisibility = VALUES(tabVisibility), roleLimits = VALUES(roleLimits), zaloGroupId = VALUES(zaloGroupId), lockPermissions = VALUES(lockPermissions)`
  );
};

export const subscribeToSettings = (callback: (settings: AppSettings) => void) => {
  let isMounted = true;
  getAppSettings().then(settings => {
    if (isMounted) callback(settings);
  }).catch(() => {
    if (isMounted) callback(DEFAULT_SETTINGS);
  });
  return () => { isMounted = false; };
};
