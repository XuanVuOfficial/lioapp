import { queryDB, escapeSQL, subscribeDB, generateId, executeMutation } from '../api';
import { Lead, UserRole } from '../types';

const parseLead = (row: any): Lead => {
  const lead = { ...row };
  if (lead.history) {
    try {
      lead.history = typeof lead.history === 'string' ? JSON.parse(lead.history) : lead.history;
    } catch (e) { lead.history = []; }
  } else {
    lead.history = [];
  }
  return lead as Lead;
};

export const sendZaloNotification = async (email: string, message: string) => {
  if (!email || !message) return;
  try {
    await fetch('/api/zalo/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, message })
    });
  } catch (err) {
    console.error('Error sending Zalo notification:', err);
  }
};

export const createLead = async (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  const id = generateId();
  const now = new Date().toISOString();
  const newLead: Lead = {
    ...lead,
    id,
    createdAt: now,
    updatedAt: now,
    assignedByEmail: lead.assignedToEmail ? lead.creatorEmail : undefined,
    assignedAt: lead.assignedToEmail ? now : undefined,
    isUpdatedByAssignee: false,
    history: [
      `[LOG][${new Date(now).toLocaleString('vi-VN')}] ${lead.creatorEmail}: Tạo mới khách hàng`,
      ...(lead.history || [])
    ]
  };

  const data = Object.fromEntries(
    Object.entries(newLead).filter(([_, v]) => v !== undefined)
  );

  const cols = Object.keys(data).join(', ');
  const vals = Object.values(data).map(v => escapeSQL(v)).join(', ');
  await executeMutation('leads', 'CREATE', newLead, `INSERT INTO leads (${cols}) VALUES (${vals})`);

  // Fire-and-forget: send push & Zalo notification to assigned employee (don't block UI)
  if (newLead.assignedToEmail) {
    const _assignedTo = newLead.assignedToEmail;
    const _name = newLead.customerName;
    const _creator = newLead.creatorEmail;
    Promise.resolve().then(async () => {
      try {
        const { sendPushNotification } = await import('./notificationService');
        sendPushNotification(_assignedTo, 'Khách hàng mới được giao 💼', `Bạn vừa được giao khách hàng ${_name} bởi ${_creator}`).catch(() => {});
        sendZaloNotification(_assignedTo, `[HKTT CRM] Bạn vừa được phân công phụ trách khách hàng: ${_name}`).catch(() => {});
      } catch (err) {
        console.error('Error sending notification for new lead:', err);
      }
    });
  }
};

export const updateLead = async (id: string, updates: Partial<Lead>, userEmail: string): Promise<void> => {
  const now = new Date().toISOString();
  let newHistory = updates.history;
  let customerName = updates.customerName;
  let assignedEmail = updates.assignedToEmail;
  let currentHistory: string[] = [];

  // Fetch current customer details and history if missing
  if (!customerName || !assignedEmail || newHistory === undefined) {
    const data = await queryDB(`SELECT customerName, assignedToEmail, history FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
    if (data && data.length > 0) {
      if (data[0].history) {
        try { currentHistory = typeof data[0].history === 'string' ? JSON.parse(data[0].history) : data[0].history; } catch (e) { currentHistory = []; }
      }
      if (!customerName) customerName = data[0].customerName;
      if (!assignedEmail) assignedEmail = data[0].assignedToEmail;
    }
  }

  // If history was not explicitly supplied by caller, build fallback history entry
  if (newHistory === undefined) {
    const timestamp = new Date(now).toLocaleString('vi-VN');
    const historyEntry = `[LOG][${timestamp}] ${userEmail}: Cập nhật thông tin khách hàng`;
    if (!Array.isArray(currentHistory)) currentHistory = [];
    newHistory = [...currentHistory, historyEntry];
  }

  const updateData: any = {
    ...updates,
    updatedAt: now,
    updatedByEmail: userEmail,
    history: newHistory
  };

  // If the assigned salesperson updates the lead, mark isUpdatedByAssignee = true to stop countdown
  if (assignedEmail && userEmail.toLowerCase() === assignedEmail.toLowerCase()) {
    updateData.isUpdatedByAssignee = true;
  }

  const setClause = Object.entries(updateData).filter(([k, v]) => v !== undefined).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
  if (setClause) {
    await executeMutation('leads', 'UPDATE', { id, ...updateData }, `UPDATE leads SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
  }
};

export const assignLead = async (id: string, assignedToEmail: string | undefined, departmentId: string | undefined, userEmail: string): Promise<void> => {
  const now = new Date().toISOString();
  const dataList = await queryDB(`SELECT customerName, phone, assignedToEmail, history FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
  let currentHistory: string[] = [];
  let customerName = 'Khách hàng';
  let phone = '';
  let prevAssignedToEmail = '';

  if (dataList && dataList.length > 0) {
    if (dataList[0].history) {
      try { currentHistory = typeof dataList[0].history === 'string' ? JSON.parse(dataList[0].history) : dataList[0].history; } catch (e) { }
    }
    if (dataList[0].customerName) customerName = dataList[0].customerName;
    if (dataList[0].phone) phone = dataList[0].phone;
    if (dataList[0].assignedToEmail) prevAssignedToEmail = dataList[0].assignedToEmail;
  }

  const timestamp = new Date(now).toLocaleString('vi-VN');
  let actionText = `Giao khách hàng`;
  if (assignedToEmail) actionText += ` cho ${assignedToEmail}`;
  if (departmentId) actionText += ` cho phòng ban ID ${departmentId}`;
  const historyEntry = `[LOG][${timestamp}] ${userEmail}: ${actionText}`;

  if (!Array.isArray(currentHistory)) currentHistory = [];
  const newHistory = [...currentHistory, historyEntry];

  const updateData: any = {
    updatedAt: now,
    updatedByEmail: userEmail,
    history: newHistory,
    assignedAt: now,
    isUpdatedByAssignee: false
  };

  if (assignedToEmail !== undefined) {
    updateData.assignedToEmail = assignedToEmail;
    updateData.assignedByEmail = userEmail;
  }
  if (departmentId !== undefined) updateData.departmentId = departmentId;

  const setClause = Object.entries(updateData).filter(([k, v]) => v !== undefined).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
  if (setClause) {
    await executeMutation('leads', 'UPDATE', { id, ...updateData }, `UPDATE leads SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
  }

  // Fire-and-forget: all notifications run in background so modal closes immediately
  const _prevEmail = prevAssignedToEmail;
  const _newEmail = assignedToEmail;
  const _custName = customerName;
  const _byEmail = userEmail;
  Promise.resolve().then(async () => {
    try {
      const { sendPushNotification } = await import('./notificationService');

      // 1. Push notification to revoked staff (no Zalo on revoke, no SĐT)
      if (_prevEmail && _prevEmail.toLowerCase() !== (_newEmail || '').toLowerCase()) {
        sendPushNotification(_prevEmail, 'Thu hồi khách hàng ⚠️', `Khách hàng ${_custName} đã bị thu hồi khỏi danh sách quản lý của bạn.`).catch(() => {});
      }

      // 2. Push & Zalo notification to newly assigned staff (no SĐT)
      if (_newEmail && _newEmail.toLowerCase() !== _prevEmail.toLowerCase()) {
        sendPushNotification(_newEmail, 'Khách hàng mới được giao 💼', `Bạn vừa được giao khách hàng ${_custName} bởi ${_byEmail}`).catch(() => {});
        sendZaloNotification(_newEmail, `[HKTT CRM] Bạn vừa được phân công phụ trách khách hàng: ${_custName}`).catch(() => {});
      }
    } catch (err) {
      console.error('Error sending notifications on assignLead:', err);
    }
  });
};

export const deleteLead = async (lead: Lead): Promise<void> => {
  await executeMutation('leads', 'DELETE', lead, `DELETE FROM leads WHERE id = ${escapeSQL(lead.id)} LIMIT 1`);
};

export const ESSENTIAL_LEAD_COLUMNS = 'id, creatorEmail, createdAt, assignedToEmail, assignedByEmail, assignedAt, isUpdatedByAssignee, departmentId, projectId, customerCode, customerName, phone, email, status, subStatus, appointmentStatus, resultStatus, interestLevel, updatedAt, updatedByEmail';

export interface LeadStatsSummary {
  total: number;
  statusCounts: {
    'Tất cả': number;
    'Chưa liên hệ': number;
    'Không liên hệ được': number;
    'Đã liên hệ': number;
    [key: string]: number;
  };
  resultCounts: {
    'Chưa booking': number;
    'Đã booking': number;
    'Đã cọc': number;
    [key: string]: number;
  };
  subStatusCounts: {
    'Đang tư vấn': number;
    'Rác / Không quan tâm': number;
    'Thuê bao': number;
    'Không bắt máy': number;
    'Bận': number;
    [key: string]: number;
  };
  projectCounts: Record<string, number>;
  deptCounts: Record<string, number>;
  dailyCounts: Array<{ date: string; count: number }>;
}

export interface LeadFilterOptions {
  role?: UserRole;
  userEmail?: string;
  departmentIds?: string[];
  projectId?: string;
  status?: string; // 'Tất cả', 'Chưa liên hệ', 'Không liên hệ được', 'Đã liên hệ'
  assignFilter?: 'all' | 'mine' | 'assigned_by_me';
  searchTerm?: string;
  selectedDeptId?: string;
  subDeptIds?: string[];
}

export interface FetchPaginatedLeadsParams extends LeadFilterOptions {
  page?: number;
  limit?: number; // Default 20
}

export interface FetchPaginatedLeadsResult {
  leads: Lead[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export const buildBaseWhereClause = (options: LeadFilterOptions, includeStatus: boolean = true): string => {
  const conditions: string[] = [];

  // Role & Department permission filtering
  if (options.role === 'staff' && options.userEmail) {
    const emailEsc = escapeSQL(options.userEmail);
    let staffCond = `(assignedToEmail = ${emailEsc} OR creatorEmail = ${emailEsc})`;
    if (options.departmentIds && options.departmentIds.length > 0 && options.departmentIds.length <= 50) {
      const ids = options.departmentIds.map(id => escapeSQL(id)).join(', ');
      staffCond += ` AND departmentId IN (${ids})`;
    }
    conditions.push(`(${staffCond})`);
  } else if (['gds', 'tp'].includes(options.role || '') && options.departmentIds && options.departmentIds.length > 0 && options.departmentIds.length <= 50) {
    const ids = options.departmentIds.map(id => escapeSQL(id)).join(', ');
    conditions.push(`departmentId IN (${ids})`);
  }

  // Selected Department Filter (e.g. subDeptIds from UI dropdown)
  if (options.subDeptIds && options.subDeptIds.length > 0) {
    const ids = options.subDeptIds.map(id => escapeSQL(id)).join(', ');
    conditions.push(`departmentId IN (${ids})`);
  } else if (options.selectedDeptId) {
    conditions.push(`departmentId = ${escapeSQL(options.selectedDeptId)}`);
  }

  // Project Filter
  if (options.projectId) {
    conditions.push(`projectId = ${escapeSQL(options.projectId)}`);
  }

  // Status Tab Filter (only if includeStatus is true)
  if (includeStatus && options.status && options.status !== 'Tất cả') {
    conditions.push(`status = ${escapeSQL(options.status)}`);
  }

  // Assignee Filter
  if (options.assignFilter === 'mine' && options.userEmail) {
    conditions.push(`assignedToEmail = ${escapeSQL(options.userEmail)}`);
  } else if (options.assignFilter === 'assigned_by_me' && options.userEmail) {
    const emailEsc = escapeSQL(options.userEmail);
    conditions.push(`(assignedByEmail = ${emailEsc} AND assignedToEmail != ${emailEsc})`);
  }

  // Search Filter
  if (options.searchTerm && options.searchTerm.trim() !== '') {
    const term = `%${options.searchTerm.trim()}%`;
    const termEsc = escapeSQL(term);
    conditions.push(`(customerName LIKE ${termEsc} OR phone LIKE ${termEsc} OR email LIKE ${termEsc})`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

export const fetchLeadStats = async (
  options: Omit<LeadFilterOptions, 'status'>
): Promise<LeadStatsSummary> => {
  const whereClause = buildBaseWhereClause(options, false);

  const sqlGroup = `
    SELECT 
      status, 
      subStatus, 
      resultStatus, 
      projectId, 
      departmentId, 
      COUNT(*) as count 
    FROM leads 
    ${whereClause} 
    GROUP BY status, subStatus, resultStatus, projectId, departmentId
  `;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const dateWhere = whereClause 
    ? `${whereClause} AND createdAt >= ${escapeSQL(sevenDaysAgoStr)}`
    : `WHERE createdAt >= ${escapeSQL(sevenDaysAgoStr)}`;

  const sqlDaily = `
    SELECT DATE(createdAt) as dateStr, COUNT(*) as count 
    FROM leads 
    ${dateWhere} 
    GROUP BY DATE(createdAt)
  `;

  try {
    const [groupData, dailyData] = await Promise.all([
      queryDB(sqlGroup),
      queryDB(sqlDaily).catch(() => [])
    ]);

    let total = 0;
    const statusCounts: Record<string, number> = {
      'Tất cả': 0,
      'Chưa liên hệ': 0,
      'Không liên hệ được': 0,
      'Đã liên hệ': 0
    };
    const resultCounts: Record<string, number> = {
      'Chưa booking': 0,
      'Đã booking': 0,
      'Đã cọc': 0
    };
    const subStatusCounts: Record<string, number> = {
      'Đang tư vấn': 0,
      'Rác / Không quan tâm': 0,
      'Thuê bao': 0,
      'Không bắt máy': 0,
      'Bận': 0
    };
    const projectCounts: Record<string, number> = {};
    const deptCounts: Record<string, number> = {};

    if (Array.isArray(groupData)) {
      for (const row of groupData) {
        const c = Number(row.count) || 0;
        total += c;

        if (row.status) {
          statusCounts[row.status] = (statusCounts[row.status] || 0) + c;
        }
        if (row.resultStatus) {
          resultCounts[row.resultStatus] = (resultCounts[row.resultStatus] || 0) + c;
        }
        if (row.subStatus) {
          subStatusCounts[row.subStatus] = (subStatusCounts[row.subStatus] || 0) + c;
        }
        if (row.projectId) {
          projectCounts[row.projectId] = (projectCounts[row.projectId] || 0) + c;
        }
        if (row.departmentId) {
          deptCounts[row.departmentId] = (deptCounts[row.departmentId] || 0) + c;
        }
      }
    }
    statusCounts['Tất cả'] = total;

    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const dailyMap: Record<string, number> = {};
    if (Array.isArray(dailyData)) {
      for (const row of dailyData) {
        const dStr = row.dateStr ? String(row.dateStr).substring(0, 10) : '';
        if (dStr) {
          dailyMap[dStr] = Number(row.count) || 0;
        }
      }
    }

    const dailyCounts = last7DaysDates.map(dStr => ({
      date: dStr.split('-').slice(1).reverse().join('/'),
      count: dailyMap[dStr] || 0
    }));

    return {
      total,
      statusCounts: statusCounts as any,
      resultCounts: resultCounts as any,
      subStatusCounts: subStatusCounts as any,
      projectCounts,
      deptCounts,
      dailyCounts
    };
  } catch (err) {
    console.error('fetchLeadStats error:', err);
    return {
      total: 0,
      statusCounts: { 'Tất cả': 0, 'Chưa liên hệ': 0, 'Không liên hệ được': 0, 'Đã liên hệ': 0 },
      resultCounts: { 'Chưa booking': 0, 'Đã booking': 0, 'Đã cọc': 0 },
      subStatusCounts: { 'Đang tư vấn': 0, 'Rác / Không quan tâm': 0, 'Thuê bao': 0, 'Không bắt máy': 0, 'Bận': 0 },
      projectCounts: {},
      deptCounts: {},
      dailyCounts: []
    };
  }
};

export const fetchPaginatedLeads = async (
  params: FetchPaginatedLeadsParams
): Promise<FetchPaginatedLeadsResult> => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const whereClause = buildBaseWhereClause(params, true);

  const countSql = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
  const dataSql = `SELECT ${ESSENTIAL_LEAD_COLUMNS} FROM leads ${whereClause} ORDER BY updatedAt DESC LIMIT ${limit} OFFSET ${offset}`;

  const [countRes, dataRes] = await Promise.all([
    queryDB(countSql),
    queryDB(dataSql)
  ]);

  const totalCount = (countRes && countRes[0] && countRes[0].total) ? Number(countRes[0].total) : 0;
  const leads = (Array.isArray(dataRes) ? dataRes : []).map(parseLead);

  const hasMore = offset + leads.length < totalCount;

  return {
    leads,
    totalCount,
    page,
    hasMore
  };
};

export const getLeadById = async (id: string): Promise<Lead | null> => {
  try {
    const data = await queryDB(`SELECT * FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
    if (data && Array.isArray(data) && data.length > 0) {
      return parseLead(data[0]);
    }
  } catch (e) {
    console.error('getLeadById error:', e);
  }
  return null;
};

export const fetchRecentLeads = async (
  limit: number = 5,
  role?: UserRole,
  email?: string,
  departmentIds?: string[]
): Promise<Lead[]> => {
  const whereClause = buildBaseWhereClause({ role, userEmail: email, departmentIds }, false);
  const sql = `SELECT ${ESSENTIAL_LEAD_COLUMNS} FROM leads ${whereClause} ORDER BY updatedAt DESC LIMIT ${limit}`;
  try {
    const data = await queryDB(sql);
    return (Array.isArray(data) ? data : []).map(parseLead);
  } catch (e) {
    console.error('fetchRecentLeads error:', e);
    return [];
  }
};

export const subscribeToLeadChanges = (
  role: UserRole,
  email: string,
  departmentIds: string[] | undefined,
  onChange: () => void,
  intervalMs: number = 5000
) => {
  let whereClause = '';
  if (departmentIds && departmentIds.length > 0 && departmentIds.length <= 10) {
    const ids = departmentIds.map(id => escapeSQL(id)).join(', ');
    whereClause = `WHERE departmentId IN (${ids})`;
  }

  let isMounted = true;
  let lastPingState = '';

  const pingCheck = async () => {
    try {
      const pingSql = `SELECT COUNT(*) as total, MAX(updatedAt) as maxUpdated FROM leads ${whereClause}`;
      const res = await queryDB(pingSql);
      if (isMounted && Array.isArray(res) && res.length > 0) {
        const currentState = `${res[0].total || 0}_${res[0].maxUpdated || ''}`;
        if (currentState !== lastPingState) {
          lastPingState = currentState;
          onChange();
        }
      }
    } catch (e) {
      console.error('pingCheck leads error', e);
    }
  };

  pingCheck();
  const interval = setInterval(pingCheck, intervalMs);

  return () => {
    isMounted = false;
    clearInterval(interval);
  };
};

export const subscribeToLeads = (
  role: UserRole,
  email: string,
  departmentIds: string[] | undefined,
  callback: (leads: Lead[]) => void,
  intervalMs: number = 5000
) => {
  return subscribeToLeadChanges(
    role,
    email,
    departmentIds,
    async () => {
      const leads = await fetchRecentLeads(50, role, email, departmentIds);
      callback(leads);
    },
    intervalMs
  );
};

