import { queryDB, escapeSQL, subscribeDB } from '../api';
import { Department } from '../types';

const parseDepartment = (row: any): Department => {
  const dep = { ...row };
  dep.level = Number(dep.level);
  return dep as Department;
};

export const createDepartment = async (dept: Department): Promise<void> => {
  try {
    const cols = Object.keys(dept).join(', ');
    const vals = Object.values(dept).map(v => escapeSQL(v)).join(', ');
    await queryDB(`INSERT INTO departments (${cols}) VALUES (${vals})`);
  } catch(e) { console.error('createDepartment error', e); }
};

export const updateDepartment = async (id: string, updates: Partial<Department>): Promise<void> => {
  try {
    const setClause = Object.entries(updates).filter(([k,v]) => v !== undefined).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
    if (setClause) {
      await queryDB(`UPDATE departments SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
    }
  } catch(e) { console.error('updateDepartment error', e); }
};

export const deleteDepartment = async (id: string): Promise<void> => {
  try {
    await queryDB(`DELETE FROM departments WHERE id = ${escapeSQL(id)} LIMIT 1`);
  } catch(e) { console.error('deleteDepartment error', e); }
};

export const subscribeToDepartments = (callback: (depts: Department[]) => void) => {
  return subscribeDB(`SELECT * FROM departments ORDER BY level ASC LIMIT 100`, (data: any[]) => {
    callback(data.map(parseDepartment));
  }, 5000);
};
