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
  lead.isUpdatedByAssignee = lead.isUpdatedByAssignee === 1 || lead.isUpdatedByAssignee === '1' || lead.isUpdatedByAssignee === true;
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
  const timestamp = new Date(now).toLocaleString('vi-VN');

  let assigneeText = 'Chưa phân công';
  if (lead.assignedToEmail) {
    let displayName = lead.assignedToEmail;
    try {
      const uData = await queryDB(`SELECT displayName FROM users WHERE email = ${escapeSQL(lead.assignedToEmail)} LIMIT 1`);
      if (uData && uData.length > 0 && uData[0].displayName) {
        displayName = uData[0].displayName;
      }
    } catch (e) { }
    assigneeText = `${displayName} (${lead.assignedToEmail})`;
  }

  const initialHistory = [
    `[LOG][${timestamp}] Người phụ trách: ${assigneeText}`,
    ...(lead.history || [])
  ];

  const newLead: Lead = {
    ...lead,
    id,
    createdAt: now,
    updatedAt: now,
    assignedByEmail: lead.assignedToEmail ? lead.creatorEmail : undefined,
    assignedAt: lead.assignedToEmail ? now : undefined,
    isUpdatedByAssignee: false,
    history: initialHistory
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
    const _projectId = newLead.projectId;
    Promise.resolve().then(async () => {
      try {
        let projectName = '';
        if (_projectId) {
          try {
            const pData = await queryDB(`SELECT name FROM projects WHERE id = ${escapeSQL(_projectId)} LIMIT 1`);
            if (pData && pData.length > 0 && pData[0].name) {
              projectName = pData[0].name;
            }
          } catch (e) { }
        }
        const projDisplay = projectName ? projectName : 'chưa xác định';
        const notificationMsg = `Bạn vừa nhận được data lead mới thuộc dự án ${projDisplay}\n\nBạn có 30 phút để cập nhật phản hồi lần 1 trên app HKTT!`;

        const { sendPushNotification } = await import('./notificationService');
        sendPushNotification(_assignedTo, 'Data lead mới 💼', notificationMsg).catch(() => { });
        sendZaloNotification(_assignedTo, notificationMsg).catch(() => { });
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
  const dataList = await queryDB(`SELECT customerName, phone, assignedToEmail, projectId, history FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
  let currentHistory: string[] = [];
  let customerName = 'Khách hàng';
  let phone = '';
  let prevAssignedToEmail = '';
  let leadProjectId = '';

  if (dataList && dataList.length > 0) {
    if (dataList[0].history) {
      try { currentHistory = typeof dataList[0].history === 'string' ? JSON.parse(dataList[0].history) : dataList[0].history; } catch (e) { }
    }
    if (dataList[0].customerName) customerName = dataList[0].customerName;
    if (dataList[0].phone) phone = dataList[0].phone;
    if (dataList[0].assignedToEmail) prevAssignedToEmail = dataList[0].assignedToEmail;
    if (dataList[0].projectId) leadProjectId = dataList[0].projectId;
  }

  const timestamp = new Date(now).toLocaleString('vi-VN');
  let assigneeText = 'Chưa phân công';
  if (assignedToEmail) {
    let displayName = assignedToEmail;
    try {
      const uData = await queryDB(`SELECT displayName FROM users WHERE email = ${escapeSQL(assignedToEmail)} LIMIT 1`);
      if (uData && uData.length > 0 && uData[0].displayName) {
        displayName = uData[0].displayName;
      }
    } catch (e) { }
    assigneeText = `${displayName} (${assignedToEmail})`;
  }
  const historyEntry = `[LOG][${timestamp}] Người phụ trách: ${assigneeText}`;

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
  const _projId = leadProjectId;
  Promise.resolve().then(async () => {
    try {
      const { sendPushNotification } = await import('./notificationService');

      // 1. Push notification to revoked staff (no Zalo on revoke, no SĐT)
      if (_prevEmail && _prevEmail.toLowerCase() !== (_newEmail || '').toLowerCase()) {
        sendPushNotification(_prevEmail, 'Thu hồi khách hàng ⚠️', `Khách hàng ${_custName} đã bị thu hồi khỏi danh sách quản lý của bạn.`).catch(() => { });
      }

      // 2. Push & Zalo notification to newly assigned staff (no SĐT)
      if (_newEmail && _newEmail.toLowerCase() !== _prevEmail.toLowerCase()) {
        let projectName = '';
        if (_projId) {
          try {
            const pData = await queryDB(`SELECT name FROM projects WHERE id = ${escapeSQL(_projId)} LIMIT 1`);
            if (pData && pData.length > 0 && pData[0].name) {
              projectName = pData[0].name;
            }
          } catch (e) { }
        }
        const projDisplay = projectName ? projectName : 'chưa xác định';
        const notificationMsg = `Bạn vừa nhận được data lead mới thuộc dự án ${projDisplay}\n\nBạn có 30 phút để cập nhật phản hồi lần 1 trên app HKTT!`;

        sendPushNotification(_newEmail, 'Data lead mới 💼', notificationMsg).catch(() => { });
        sendZaloNotification(_newEmail, notificationMsg).catch(() => { });
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
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
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
    if (options.status === 'Chờ phân chia data') {
      conditions.push(`(assignedToEmail IS NULL OR assignedToEmail = '')`);
    } else {
      conditions.push(`status = ${escapeSQL(options.status)}`);
    }
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

  // Date Range Filter
  if (options.startDate) {
    const startEsc = escapeSQL(options.startDate + ' 00:00:00');
    conditions.push(`createdAt >= ${startEsc}`);
  }
  if (options.endDate) {
    const endEsc = escapeSQL(options.endDate + ' 23:59:59');
    conditions.push(`createdAt <= ${endEsc}`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

export const fetchLeadStats = async (
  options: Omit<LeadFilterOptions, 'status'>
): Promise<LeadStatsSummary> => {
  const whereClause = buildBaseWhereClause(options, false);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  // Combined single SQL query for both stats summary & 7 days daily counts
  const sqlCombined = `
    SELECT 
      status, 
      subStatus, 
      resultStatus, 
      projectId, 
      departmentId, 
      (assignedToEmail IS NULL OR assignedToEmail = '') as isUnassigned,
      DATE(createdAt) as dateStr,
      COUNT(*) as count 
    FROM leads 
    ${whereClause} 
    GROUP BY status, subStatus, resultStatus, projectId, departmentId, (assignedToEmail IS NULL OR assignedToEmail = ''), DATE(createdAt)
  `;

  try {
    const groupData = await queryDB(sqlCombined);

    let total = 0;
    const statusCounts: Record<string, number> = {
      'Tất cả': 0,
      'Chờ phân chia data': 0,
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
    const dailyMap: Record<string, number> = {};

    if (Array.isArray(groupData)) {
      for (const row of groupData) {
        const c = Number(row.count) || 0;
        total += c;

        if (row.isUnassigned === 1 || row.isUnassigned === '1' || row.isUnassigned === true) {
          statusCounts['Chờ phân chia data'] = (statusCounts['Chờ phân chia data'] || 0) + c;
        }
        if (row.status) statusCounts[row.status] = (statusCounts[row.status] || 0) + c;
        if (row.resultStatus) resultCounts[row.resultStatus] = (resultCounts[row.resultStatus] || 0) + c;
        if (row.subStatus) subStatusCounts[row.subStatus] = (subStatusCounts[row.subStatus] || 0) + c;
        if (row.projectId) projectCounts[row.projectId] = (projectCounts[row.projectId] || 0) + c;
        if (row.departmentId) deptCounts[row.departmentId] = (deptCounts[row.departmentId] || 0) + c;

        const dStr = row.dateStr ? String(row.dateStr).substring(0, 10) : '';
        if (dStr && dStr >= sevenDaysAgoStr) {
          dailyMap[dStr] = (dailyMap[dStr] || 0) + c;
        }
      }
    }
    statusCounts['Tất cả'] = total;

    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

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

export interface ProjectStatsSummary {
  [projectId: string]: {
    totalLeads: number;
    contactedLeads: number;
    closedLeads: number;
  };
}

export const fetchProjectStatsSummary = async (
  role?: UserRole,
  userEmail?: string,
  departmentIds?: string[]
): Promise<ProjectStatsSummary> => {
  const whereClause = buildBaseWhereClause({ role, userEmail, departmentIds }, false);
  const sql = `
    SELECT 
      projectId,
      COUNT(*) as totalLeads,
      SUM(CASE WHEN status = 'Đã liên hệ' THEN 1 ELSE 0 END) as contactedLeads,
      SUM(CASE WHEN resultStatus IN ('Đã booking', 'Đã cọc') THEN 1 ELSE 0 END) as closedLeads
    FROM leads
    ${whereClause}
    GROUP BY projectId
  `;

  const result: ProjectStatsSummary = {};
  try {
    const data = await queryDB(sql);
    if (Array.isArray(data)) {
      for (const row of data) {
        if (row.projectId) {
          result[row.projectId] = {
            totalLeads: Number(row.totalLeads) || 0,
            contactedLeads: Number(row.contactedLeads) || 0,
            closedLeads: Number(row.closedLeads) || 0
          };
        }
      }
    }
  } catch (err) {
    console.error('fetchProjectStatsSummary error:', err);
  }
  return result;
};

export const fetchPaginatedLeads = async (
  params: FetchPaginatedLeadsParams
): Promise<FetchPaginatedLeadsResult> => {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const whereClause = buildBaseWhereClause(params, true);

  // Single SQL Query: Fetch limit + 1 items to determine hasMore without COUNT(*)
  const dataSql = `SELECT ${ESSENTIAL_LEAD_COLUMNS} FROM leads ${whereClause} ORDER BY updatedAt DESC LIMIT ${limit + 1} OFFSET ${offset}`;

  const dataRes = await queryDB(dataSql);
  const rawList = (Array.isArray(dataRes) ? dataRes : []).map(parseLead);

  const hasMore = rawList.length > limit;
  const leads = hasMore ? rawList.slice(0, limit) : rawList;

  return {
    leads,
    totalCount: 0,
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

export interface DashboardData {
  statsSummary: LeadStatsSummary;
  recentLeads: Lead[];
}

export const fetchDashboardData = async (
  options: Omit<LeadFilterOptions, 'status'>
): Promise<DashboardData> => {
  const [statsSummary, recentLeads] = await Promise.all([
    fetchLeadStats(options),
    fetchRecentLeads(5, options.role, options.userEmail, options.departmentIds)
  ]);
  return {
    statsSummary,
    recentLeads
  };
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
  if (role === 'staff') {
    whereClause = `WHERE (assignedToEmail = ${escapeSQL(email)} OR creatorEmail = ${escapeSQL(email)})`;
  } else if (departmentIds && departmentIds.length > 0 && departmentIds.length <= 10) {
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
        if (!lastPingState) {
          lastPingState = currentState;
        } else if (currentState !== lastPingState) {
          lastPingState = currentState;
          onChange();
        }
      }
    } catch (e) {
      console.error('pingCheck leads error', e);
    }
  };

  // Only run interval pinging, do not fire immediately to prevent duplicate queries on tab changes
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

