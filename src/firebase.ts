import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyA8BZtkme7dJNnqtgvh-y7hbx045uAmDBE",
  authDomain: "parkease-5ebcc.firebaseapp.com",
  databaseURL: "https://parkease-5ebcc-default-rtdb.firebaseio.com",
  projectId: "parkease-5ebcc",
  storageBucket: "parkease-5ebcc.firebasestorage.app",
  messagingSenderId: "705819674876",
  appId: "1:705819674876:web:6e29bd06271b3e4e192f79"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
