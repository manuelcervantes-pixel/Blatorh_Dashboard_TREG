// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyA8k5xbZd4GxHyfFCLVaibctKfvgmEf1AE",
  authDomain: "workforce-analytics-b4b47.firebaseapp.com",
  projectId: "workforce-analytics-b4b47",
  storageBucket: "workforce-analytics-b4b47.firebasestorage.app",
  messagingSenderId: "1095438321730",
  appId: "1:1095438321730:web:6ffe5c1e0a5e81e73805db",
  measurementId: "G-HL5FWN67Z5"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);