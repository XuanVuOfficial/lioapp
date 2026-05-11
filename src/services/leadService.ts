import { queryDB, escapeSQL, subscribeDB, generateId } from '../api';
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
  try {
    const id = generateId();
    const now = new Date().toISOString();
    const newLead: Lead = {
      ...lead,
      id,
      createdAt: now,
      updatedAt: now,
      assignedByEmail: lead.assignedToEmail ? lead.creatorEmail : undefined,
      history: [`Được tạo bởi ${lead.creatorEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`]
    };
    
    const data = Object.fromEntries(
      Object.entries(newLead).filter(([_, v]) => v !== undefined)
    );
    
    const cols = Object.keys(data).join(', ');
    const vals = Object.values(data).map(v => escapeSQL(v)).join(', ');
    await queryDB(`INSERT INTO leads (${cols}) VALUES (${vals})`);
  } catch(e) { console.error('createLead error', e); }
};

export const updateLead = async (id: string, updates: Partial<Lead>, userEmail: string): Promise<void> => {
  try {
    const now = new Date().toISOString();
    let newHistory = updates.history;
    
    if (!newHistory) {
      const data = await queryDB(`SELECT history FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
      let currentHistory: string[] = [];
      if (data && data.length > 0 && data[0].history) {
        try { currentHistory = typeof data[0].history === 'string' ? JSON.parse(data[0].history) : data[0].history; } catch(e){}
      }
      const historyEntry = `Cập nhật bởi ${userEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`;
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
      await queryDB(`UPDATE leads SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
    }
  } catch(e) { console.error('updateLead error', e); }
};

export const assignLead = async (id: string, assignedToEmail: string | undefined, departmentId: string | undefined, userEmail: string): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const dataList = await queryDB(`SELECT history FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
    let currentHistory: string[] = [];
    if (dataList && dataList.length > 0 && dataList[0].history) {
      try { currentHistory = typeof dataList[0].history === 'string' ? JSON.parse(dataList[0].history) : dataList[0].history; } catch(e){}
    }
    
    let historyEntry = `Giao việc bởi ${userEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`;
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
      await queryDB(`UPDATE leads SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
    }
  } catch(e) { console.error('assignLead error', e); }
};

export const deleteLead = async (id: string): Promise<void> => {
  try {
    await queryDB(`DELETE FROM leads WHERE id = ${escapeSQL(id)} LIMIT 1`);
  } catch(e) { console.error('deleteLead error', e); }
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
