import { queryDB, escapeSQL, subscribeDB } from '../api';

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
}

const DEFAULT_SETTINGS: AppSettings = {
  tabVisibility: {
    admin: ['dashboard', 'leads', 'projects', 'departments', 'staff', 'settings'],
    tp: ['dashboard', 'leads', 'projects', 'departments', 'staff'],
    staff: ['dashboard', 'leads']
  },
  roleLimits: {
    tgd: null,
    admin: null,
    gds: null,
    tp: null,
    staff: null
  }
};

const parseSettings = (row: any): AppSettings => {
  const settings = { ...DEFAULT_SETTINGS };
  if (row.tabVisibility) {
    try {
      settings.tabVisibility = typeof row.tabVisibility === 'string' ? JSON.parse(row.tabVisibility) : row.tabVisibility;
    } catch(e){}
  }
  if (row.roleLimits) {
    try {
      settings.roleLimits = typeof row.roleLimits === 'string' ? JSON.parse(row.roleLimits) : row.roleLimits;
    } catch(e){}
  }
  return settings;
}

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const data = await queryDB(`SELECT * FROM settings WHERE id = ${escapeSQL(DOC_ID)} LIMIT 1`);
    if (data && data.length > 0) {
      return parseSettings(data[0]);
    }
    
    // Initialize with defaults if not exists
    await updateAppSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch(e) { console.error('getAppSettings error', e); return DEFAULT_SETTINGS; }
};

export const updateAppSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await queryDB(`INSERT INTO settings (id, tabVisibility, roleLimits) VALUES (${escapeSQL(DOC_ID)}, ${escapeSQL(settings.tabVisibility)}, ${escapeSQL(settings.roleLimits)}) ON DUPLICATE KEY UPDATE tabVisibility = VALUES(tabVisibility), roleLimits = VALUES(roleLimits)`);
  } catch(e) { console.error('updateAppSettings error', e); }
};

export const subscribeToSettings = (callback: (settings: AppSettings) => void) => {
  return subscribeDB(`SELECT * FROM settings WHERE id = ${escapeSQL(DOC_ID)} LIMIT 1`, (data: any[]) => {
    if (data && data.length > 0) {
      callback(parseSettings(data[0]));
    } else {
      callback(DEFAULT_SETTINGS);
    }
  }, 10000);
};
