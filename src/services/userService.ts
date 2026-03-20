import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { UserProfile, OperationType, UserRole } from '../types';

const COLLECTION = 'users';

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${COLLECTION}/${uid}`);
    return null;
  }
};

export const getUserProfileByEmail = async (email: string): Promise<UserProfile | null> => {
  try {
    const q = query(collection(db, COLLECTION), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION);
    return null;
  }
};

export const createUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, profile.uid);
    // Remove undefined fields for Firestore
    const data = Object.fromEntries(
      Object.entries(profile).filter(([_, v]) => v !== undefined)
    );
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${COLLECTION}/${profile.uid}`);
  }
};

export const updateUserRole = async (uid: string, role: UserRole, departmentId?: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, uid);
    const updateData: any = { role };
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${uid}`);
  }
};

export const subscribeToUsersByDepartment = (departmentId: string, callback: (users: UserProfile[]) => void) => {
  const q = query(collection(db, COLLECTION), where('departmentId', '==', departmentId));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => doc.data() as UserProfile);
    callback(users);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION);
  });
};

export const subscribeToAllUsers = (callback: (users: UserProfile[]) => void) => {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => doc.data() as UserProfile);
    callback(users);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION);
  });
};

export const deleteUser = async (uid: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION, uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION}/${uid}`);
  }
};
