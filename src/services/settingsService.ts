import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';

const COLLECTION = 'settings';
const DOC_ID = 'app_settings';

export interface AppSettings {
  tabVisibility: Record<string, string[]>; // role -> list of tab IDs
}

const DEFAULT_SETTINGS: AppSettings = {
  tabVisibility: {
    admin: ['dashboard', 'leads', 'projects', 'departments', 'staff', 'settings'],
    tp: ['dashboard', 'leads', 'projects', 'departments', 'staff'],
    staff: ['dashboard', 'leads']
  }
};

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const docRef = doc(db, COLLECTION, DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    }
    // Initialize with defaults if not exists
    await setDoc(docRef, DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${COLLECTION}/${DOC_ID}`);
    return DEFAULT_SETTINGS;
  }
};

export const updateAppSettings = async (settings: AppSettings): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION, DOC_ID);
    await setDoc(docRef, settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION}/${DOC_ID}`);
  }
};

export const subscribeToSettings = (callback: (settings: AppSettings) => void) => {
  const docRef = doc(db, COLLECTION, DOC_ID);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as AppSettings);
    } else {
      callback(DEFAULT_SETTINGS);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `${COLLECTION}/${DOC_ID}`);
  });
};
