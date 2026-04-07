import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Lead, OperationType, UserRole } from '../types';

const COLLECTION = 'leads';

export const createLead = async (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    const docRef = doc(collection(db, COLLECTION));
    const now = new Date().toISOString();
    const newLead: Lead = {
      ...lead,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
      history: [`Được tạo bởi ${lead.creatorEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`]
    };
    // Remove undefined fields for Firestore
    const data = Object.fromEntries(
      Object.entries(newLead).filter(([_, v]) => v !== undefined)
    );
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION);
  }
};

export const updateLead = async (id: string, updates: Partial<Lead>, userEmail: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, id);
    const now = new Date().toISOString();
    
    // Get current lead to append to history if not provided in updates
    let newHistory = updates.history;
    if (!newHistory) {
      const docSnap = await getDoc(docRef);
      const currentHistory = docSnap.exists() ? (docSnap.data() as Lead).history : [];
      const historyEntry = `Cập nhật bởi ${userEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`;
      newHistory = [...currentHistory, historyEntry];
    }

    const updateData: any = {
      ...updates,
      updatedAt: now,
      updatedByEmail: userEmail,
      history: newHistory
    };

    // Remove undefined fields for Firestore
    const data = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${id}`);
  }
};

export const assignLead = async (id: string, assignedToEmail: string | undefined, departmentId: string | undefined, userEmail: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, id);
    const now = new Date().toISOString();
    
    // Get current lead to append to history
    const docSnap = await getDoc(docRef);
    const currentHistory = docSnap.exists() ? (docSnap.data() as Lead).history : [];
    let historyEntry = `Giao việc bởi ${userEmail} lúc ${new Date(now).toLocaleString('vi-VN')}`;
    if (assignedToEmail) historyEntry += ` cho ${assignedToEmail}`;
    if (departmentId) historyEntry += ` cho phòng ban ID ${departmentId}`;
    
    const newHistory = [...currentHistory, historyEntry];

    const updateData: any = {
      updatedAt: now,
      updatedByEmail: userEmail,
      history: newHistory
    };
    
    if (assignedToEmail !== undefined) updateData.assignedToEmail = assignedToEmail;
    if (departmentId !== undefined) updateData.departmentId = departmentId;

    // Remove undefined fields for Firestore
    const data = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${id}`);
  }
};

export const subscribeToLeads = (role: UserRole, email: string, departmentIds: string[] | undefined, callback: (leads: Lead[]) => void) => {
  let q = query(collection(db, COLLECTION), orderBy('updatedAt', 'desc'));

  if (role === 'tp' && departmentIds && departmentIds.length > 0) {
    if (departmentIds.length <= 10) {
      q = query(collection(db, COLLECTION), where('departmentId', 'in', departmentIds), orderBy('updatedAt', 'desc'));
    }
  } else if (role === 'staff') {
    q = query(collection(db, COLLECTION), where('assignedToEmail', '==', email), orderBy('updatedAt', 'desc'));
  }

  return onSnapshot(q, (snapshot) => {
    let leads = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Lead);
    
    // Client-side filtering for cases where we have more than 10 departments or other complex logic
    if (role === 'tp' && departmentIds && departmentIds.length > 10) {
      leads = leads.filter(l => l.departmentId && departmentIds.includes(l.departmentId));
    }
    
    callback(leads);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION);
  });
};
