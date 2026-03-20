import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { Department, OperationType } from '../types';

const COLLECTION = 'departments';

export const createDepartment = async (dept: Department): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, dept.id);
    // Remove undefined fields for Firestore
    const data = Object.fromEntries(
      Object.entries(dept).filter(([_, v]) => v !== undefined)
    );
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${COLLECTION}/${dept.id}`);
  }
};

export const updateDepartment = async (id: string, updates: Partial<Department>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${id}`);
  }
};

export const deleteDepartment = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION}/${id}`);
  }
};

export const subscribeToDepartments = (callback: (depts: Department[]) => void) => {
  const q = query(collection(db, COLLECTION), orderBy('level', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const depts = snapshot.docs.map(doc => doc.data() as Department);
    callback(depts);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION);
  });
};
