import { queryDB, escapeSQL, subscribeDB, generateId, executeMutation } from '../api';
import { UserProfile, UserRole } from '../types';

const parseUser = (row: any): UserProfile => {
  const user = { ...row };
  if (user.managedDeptIds && typeof user.managedDeptIds === 'string') {
    try {
      user.managedDeptIds = JSON.parse(user.managedDeptIds);
    } catch(e) {}
  }
  user.mustChangePassword = user.mustChangePassword === '1' || user.mustChangePassword === 1 || user.mustChangePassword === true;
  user.createdAt = user.createdAt ? Number(user.createdAt) : undefined;
  user.updatedAt = user.updatedAt ? Number(user.updatedAt) : undefined;
  return user as UserProfile;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const data = await queryDB(`SELECT * FROM users WHERE uid = ${escapeSQL(uid)} LIMIT 1`);
    if (data && data.length > 0) {
      return parseUser(data[0]);
    }
  } catch(e) { console.error('getUserProfile error', e); }
  return null;
};

export const getUserProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  try {
    const data = await queryDB(`SELECT * FROM users WHERE email = ${escapeSQL(email)} LIMIT 1`);
    if (data && data.length > 0) {
      return parseUser(data[0]);
    }
  } catch(e) { console.error('getUserProfileByEmail error', e); }
  return null;
};

export const verifyCredentials = async (email: string, pass: string): Promise<UserProfile | null> => {
  try {
    const data = await queryDB(`SELECT * FROM users WHERE email = ${escapeSQL(email)} AND password = ${escapeSQL(pass)} LIMIT 1`);
    if (data && data.length > 0) {
      return parseUser(data[0]);
    }
  } catch(e) { console.error('verifyCredentials error', e); }
  return null;
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  const cols = Object.keys(profile).join(', ');
  const vals = Object.values(profile).map(v => escapeSQL(v)).join(', ');
  await executeMutation('users', 'CREATE', profile, `INSERT INTO users (${cols}) VALUES (${vals})`);
};

export const createStaffAccount = async (profile: Omit<UserProfile, 'uid'>, password: string): Promise<void> => {
  const uid = 'user_' + generateId();
  await createUserProfile({
    ...profile,
    uid,
    password
  });
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>): Promise<void> => {
  const setClause = Object.entries(updates).filter(([k,v]) => v !== undefined).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
  if (setClause) {
    await executeMutation('users', 'UPDATE', { uid, ...updates }, `UPDATE users SET ${setClause} WHERE uid = ${escapeSQL(uid)} LIMIT 1`);
  }
};

export const updateUserRole = async (uid: string, role: UserRole, departmentId?: string): Promise<void> => {
  const updates: any = { role };
  if (departmentId !== undefined) updates.departmentId = departmentId;
  else updates.departmentId = null;
  
  const setClause = Object.entries(updates).map(([k, v]) => `${k} = ${escapeSQL(v)}`).join(', ');
  await executeMutation('users', 'UPDATE', { uid, ...updates }, `UPDATE users SET ${setClause} WHERE uid = ${escapeSQL(uid)} LIMIT 1`);
};

export const subscribeToUsersByDepartment = (departmentId: string, callback: (users: UserProfile[]) => void) => {
  return subscribeDB(`SELECT * FROM users WHERE departmentId = ${escapeSQL(departmentId)} ORDER BY createdAt DESC LIMIT 500`, (data: any[]) => {
    callback(data.map(parseUser));
  }, 5000);
};

export const subscribeToAllUsers = (callback: (users: UserProfile[]) => void) => {
  return subscribeDB(`SELECT * FROM users ORDER BY createdAt DESC LIMIT 500`, (data: any[]) => {
    callback(data.map(parseUser));
  }, 5000);
};

export const deleteUser = async (user: UserProfile): Promise<void> => {
  await executeMutation('users', 'DELETE', user, `DELETE FROM users WHERE uid = ${escapeSQL(user.uid)} LIMIT 1`);
};
