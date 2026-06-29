import { queryDB, escapeSQL, subscribeDB, generateId, executeMutation } from '../api';
import { Lead, UserRole } from '../types';

const parseLead = (row: any): Lead => {
  const lead = { ...row };
  if (lead.history) {
    try {
      lead.history = typeof lead.history === 'string' ? JSON.parse(lead.history) : lead.history;
    } catch(e) { lead.history = []; }
  } else {
    lead.history = [];
  }
  return lead as Lead;
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
    history: [
      `[LOG] Được tạo bởi ${lead.creatorEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`,
      ...(lead.history || [])
    ]
  };
  
  const data = Object.fromEntries(
    Object.entries(newLead).filter(([_, v]) => v !== undefined)
  );
  
  const cols = Object.keys(data).join(', ');
  const vals = Object.values(data).map(v => escapeSQL(v)).join(', ');
  await executeMutation('leads', 'CREATE', newLead, `INSERT INTO leads (${cols}) VALUES (${vals})`);

  // Send push notification to assigned employee
  if (newLead.assignedToEmail) {
    try {
      const { sendPushNotification } = await import('./notificationService');
      await sendPushNotification(
        newLead.assignedToEmail,
        'Khách hàng mới được giao 💼',
        `Bạn vừa được giao khách hàng ${newLead.customerName} bởi ${newLead.creatorEmail}`
      );
    } catch (err) {
      console.error('Error sending push notification for new lead:', err);
    }
  }
};

export const updateLead = async (id: string, updates: Partial<Lead>, userEmail: string): Promise<void> => {
  const now = new Date().toISOString();
  let newHistory = updates.history;
  let customerName = updates.customerName;
  let assignedEmail = updates.assignedToEmail;
  
  if (!newHistory || !customerName || !assignedEmail) {
    // Fetch current details from DB
    const data = await queryDB(`SELECT customerName, assignedToEmail, history FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
    let currentHistory: string[] = [];
    if (data && data.length > 0) {
      if (data[0].history) {
        try { currentHistory = typeof data[0].history === 'string' ? JSON.parse(data[0].history) : data[0].history; } catch(e){}
      }
      if (!customerName) customerName = data[0].customerName;
      if (!assignedEmail) assignedEmail = data[0].assignedToEmail;
    }
    const historyEntry = `[LOG] Cập nhật bởi ${userEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`;
    if (!Array.isArray(currentHistory)) currentHistory = [];
    newHistory = [...currentHistory, historyEntry];
  }

  const updateData: any = {
    ...updates,
    updatedAt: now,
    updatedByEmail: userEmail,
    history: newHistory
  };

  const setClause = Object.entries(updateData).filter(([k,v]) => v !== undefined).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
  if (setClause) {
    await executeMutation('leads', 'UPDATE', { id, ...updateData }, `UPDATE leads SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
  }

  // Notify assigned salesperson of the lead update if updated by someone else
  if (assignedEmail && assignedEmail !== userEmail) {
    try {
      const { sendPushNotification } = await import('./notificationService');
      await sendPushNotification(
        assignedEmail,
        'Cập nhật thông tin khách hàng ✍️',
        `Khách hàng ${customerName || 'của bạn'} vừa được cập nhật bởi ${userEmail}`
      );
    } catch (err) {
      console.error('Error sending push notification on updateLead:', err);
    }
  }
};

export const assignLead = async (id: string, assignedToEmail: string | undefined, departmentId: string | undefined, userEmail: string): Promise<void> => {
  const now = new Date().toISOString();
  const dataList = await queryDB(`SELECT customerName, history FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
  let currentHistory: string[] = [];
  let customerName = 'Khách hàng';
  
  if (dataList && dataList.length > 0) {
    if (dataList[0].history) {
      try { currentHistory = typeof dataList[0].history === 'string' ? JSON.parse(dataList[0].history) : dataList[0].history; } catch(e){}
    }
    if (dataList[0].customerName) {
      customerName = dataList[0].customerName;
    }
  }
  
  let historyEntry = `[LOG] Giao việc bởi ${userEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`;
  if (assignedToEmail) historyEntry += ` cho ${assignedToEmail}`;
  if (departmentId) historyEntry += ` cho phòng ban ID ${departmentId}`;
  if (!Array.isArray(currentHistory)) currentHistory = [];
  const newHistory = [...currentHistory, historyEntry];

  const updateData: any = {
    updatedAt: now,
    updatedByEmail: userEmail,
    history: newHistory
  };
  
  if (assignedToEmail !== undefined) {
    updateData.assignedToEmail = assignedToEmail;
    updateData.assignedByEmail = userEmail;
  }
  if (departmentId !== undefined) updateData.departmentId = departmentId;

  const setClause = Object.entries(updateData).filter(([k,v]) => v !== undefined).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
  if (setClause) {
    await executeMutation('leads', 'UPDATE', { id, ...updateData }, `UPDATE leads SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
  }

  // Notify assigned employee of lead assignment
  if (assignedToEmail) {
    try {
      const { sendPushNotification } = await import('./notificationService');
      await sendPushNotification(
        assignedToEmail,
        'Khách hàng mới được giao 💼',
        `Bạn vừa được giao khách hàng ${customerName} bởi ${userEmail}`
      );
    } catch (err) {
      console.error('Error sending push notification on assignLead:', err);
    }
  }
};

export const deleteLead = async (lead: Lead): Promise<void> => {
  await executeMutation('leads', 'DELETE', lead, `DELETE FROM leads WHERE id = ${escapeSQL(lead.id)} LIMIT 1`);
};

export const subscribeToLeads = (role: UserRole, email: string, departmentIds: string[] | undefined, callback: (leads: Lead[]) => void) => {
  let whereClause = '';
  if (departmentIds && departmentIds.length > 0 && departmentIds.length <= 10) {
    const ids = departmentIds.map(id => escapeSQL(id)).join(', ');
    whereClause = `WHERE departmentId IN (${ids})`;
  }

  const sql = `SELECT * FROM leads ${whereClause} ORDER BY updatedAt DESC LIMIT 1000`;

  return subscribeDB(sql, (data: any[]) => {
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
  }, 5000);
};
