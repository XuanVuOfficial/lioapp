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

export interface FetchLeadsParams {
  page?: number;
  limit?: number;
  status?: string;
  projectId?: string;
  departmentId?: string;
  allowedDeptIds?: string[];
  assignFilter?: 'all' | 'mine' | 'assigned_by_me';
  searchTerm?: string;
  userEmail?: string;
  userRole?: string;
}

export interface FetchLeadsResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  countsByStatus: Record<string, number>;
  leads: Lead[];
}

export const fetchLeadsPaginated = async (params: FetchLeadsParams): Promise<FetchLeadsResponse> => {
  try {
    const res = await fetch('/api/leads/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data;
      }
    }
  } catch (e) {
    console.error('fetchLeadsPaginated error:', e);
  }
  return {
    success: false,
    total: 0,
    page: 1,
    limit: 20,
    hasMore: false,
    countsByStatus: { 'Tất cả': 0, 'Chưa liên hệ': 0, 'Không liên hệ được': 0, 'Đã liên hệ': 0 },
    leads: []
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

export const subscribeToLeads = (
  role: UserRole,
  email: string,
  departmentIds: string[] | undefined,
  callback: (leads: Lead[]) => void,
  intervalMs: number = 5000
) => {
  let whereClause = '';
  if (departmentIds && departmentIds.length > 0 && departmentIds.length <= 10) {
    const ids = departmentIds.map(id => escapeSQL(id)).join(', ');
    whereClause = `WHERE departmentId IN (${ids})`;
  }

  let isMounted = true;
  let lastPingState = '';
  let isFetching = false;

  const fetchFullLeads = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
      const sql = `SELECT ${ESSENTIAL_LEAD_COLUMNS} FROM leads ${whereClause} ORDER BY updatedAt DESC LIMIT 1000`;
      const data = await queryDB(sql);
      if (isMounted && Array.isArray(data)) {
        let leads = data.map(parseLead);

        if (['tgd', 'admin'].includes(role)) {
          // Sees everything
        } else if (['gds', 'tp'].includes(role)) {
          if (departmentIds) {
            leads = leads.filter(l => l.departmentId && departmentIds.includes(l.departmentId));
          }
        } else if (role === 'staff') {
          leads = leads.filter(l =>
            (departmentIds && l.departmentId && departmentIds.includes(l.departmentId)) &&
            (l.assignedToEmail === email || l.creatorEmail === email)
          );
        }

        callback(leads);
      }
    } catch (e) {
      console.error('fetchFullLeads error', e);
    } finally {
      isFetching = false;
    }
  };

  const pingCheck = async () => {
    try {
      // Lightweight Ping: check total count & MAX(updatedAt) without pulling heavy lead payload
      const pingSql = `SELECT COUNT(*) as total, MAX(updatedAt) as maxUpdated FROM leads ${whereClause}`;
      const res = await queryDB(pingSql);
      if (isMounted && Array.isArray(res) && res.length > 0) {
        const currentState = `${res[0].total || 0}_${res[0].maxUpdated || ''}`;
        if (currentState !== lastPingState) {
          lastPingState = currentState;
          await fetchFullLeads();
        }
      } else if (isMounted) {
        await fetchFullLeads();
      }
    } catch (e) {
      console.error('pingCheck leads error', e);
      if (isMounted && !lastPingState) {
        await fetchFullLeads();
      }
    }
  };

  pingCheck();
  const interval = setInterval(pingCheck, intervalMs);

  return () => {
    isMounted = false;
    clearInterval(interval);
  };
};
