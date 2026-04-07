import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo } from './types';

const app = initializeApp(firebaseConfig);

// Try to use the named database if provided, otherwise fallback to default
let firestoreDb;
try {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  firestoreDb = getFirestore(app, dbId && dbId !== '(default)' ? dbId : '(default)');
} catch (e) {
  console.warn('Failed to initialize named Firestore database, falling back to (default)', e);
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('salespro_uid') || undefined,
      providerInfo: []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
