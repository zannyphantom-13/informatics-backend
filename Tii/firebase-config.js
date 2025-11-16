// firebase-config.js
// Frontend Firebase Realtime Database setup for real-time OTP updates
// Replace YOUR_CONFIG below with your actual Firebase config from Firebase Console

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getDatabase, ref, onValue, off } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";

// ============================================
// FIREBASE CONFIG (from Firebase Console > Project Settings)
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyA41gE4vLK0uigW981OUHqoVM9xh5dSZE0",
  authDomain: "tii-web.firebaseapp.com",
  databaseURL: "https://tii-web-default-rtdb.firebaseio.com",
  projectId: "tii-web",
  storageBucket: "tii-web.appspot.com",
  messagingSenderId: "793315940673",
  appId: "1:793315940673:web:adbf5fe822ba8c1178e9c0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================================
// LISTEN FOR REAL-TIME OTP UPDATES
// ============================================
// Real-time OTP listener removed — OTP flow deprecated.

export { db };
