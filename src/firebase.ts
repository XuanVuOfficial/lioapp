import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgI3tKou03KY50r7y-xgR86V32sdck0ZQ",
  authDomain: "untitled1-b15a7.firebaseapp.com",
  databaseURL: "https://untitled1-b15a7-default-rtdb.firebaseio.com",
  projectId: "untitled1-b15a7",
  storageBucket: "untitled1-b15a7.firebasestorage.app",
  messagingSenderId: "696442413906",
  appId: "1:696442413906:web:aae870477f7c6d3aded08b",
  measurementId: "G-WNP1WQWETN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const messaging = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator ? getMessaging(app) : null;

export { app, database, messaging, ref, set, get, child, getToken, onMessage };
