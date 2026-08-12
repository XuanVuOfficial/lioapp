import { queryDB, escapeSQL, subscribeDB, executeMutation } from '../api';
import { Department } from '../types';

const parseDepartment = (row: any): Department => {
  const dep = { ...row };
  dep.level = Number(dep.level);
  return dep as Department;
};

export const createDepartment = async (dept: Department): Promise<void> => {
  const cols = Object.keys(dept).join(', ');
  const vals = Object.values(dept).map(v => escapeSQL(v)).join(', ');
  await executeMutation('departments', 'CREATE', dept, `INSERT INTO departments (${cols}) VALUES (${vals})`);
};

export const updateDepartment = async (id: string, updates: Partial<Department>): Promise<void> => {
  const setClause = Object.entries(updates).filter(([k,v]) => v !== undefined).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
  if (setClause) {
    await executeMutation('departments', 'UPDATE', { id, ...updates }, `UPDATE departments SET ${setClause} WHERE id = ${escapeSQL(id)} LIMIT 1`);
  }
};

export const deleteDepartment = async (dept: Department): Promise<void> => {
  await executeMutation('departments', 'DELETE', dept, `DELETE FROM departments WHERE id = ${escapeSQL(dept.id)} LIMIT 1`);
};

export const subscribeToDepartments = (callback: (depts: Department[]) => void) => {
  return subscribeDB(`SELECT * FROM departments ORDER BY level ASC LIMIT 100`, (data: any[]) => {
    callback(data.map(parseDepartment));
  }, 5000);
};
