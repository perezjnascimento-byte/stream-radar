import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword as fbSignIn, 
  createUserWithEmailAndPassword as fbCreateUser, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc as fbDoc, 
  getDoc as fbGetDoc, 
  setDoc as fbSetDoc, 
  updateDoc as fbUpdateDoc 
} from 'firebase/firestore';

// ==========================================
// IDX FIREBASE CONFIGURATION PLACEHOLDER
// Paste your auto-generated config here if needed:
// ==========================================
/*
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
*/

// Active config loaded from environmental VITE_ variables or local fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Check if credentials are set and not placeholders
const isConfigured = !!firebaseConfig.apiKey && 
                     firebaseConfig.apiKey.trim() !== "" && 
                     !firebaseConfig.apiKey.includes("SUA_API_KEY");

let app;
let auth;
let db;

if (isConfigured) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase inicializado com sucesso em modo Real.");
  } catch (error) {
    console.error("Falha ao inicializar Firebase Real. Usando Mock Fallback:", error);
    auth = null;
    db = null;
  }
} else {
  console.warn("Chaves do Firebase não configuradas. Usando Mock Firebase para desenvolvimento local.");
}

// --- MOCK FIREBASE IMPLEMENTATION ---
const mockAuthListeners = [];
let currentMockUser = (() => {
  try {
    const saved = localStorage.getItem('mock_firebase_current_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
})();

const notifyAuthListeners = () => {
  mockAuthListeners.forEach(cb => cb(currentMockUser));
};

const mockAuth = {
  currentUser: currentMockUser
};

export const signIn = async (email, password) => {
  if (isConfigured && auth) {
    const credential = await fbSignIn(auth, email, password);
    return credential.user;
  } else {
    const mockUsers = JSON.parse(localStorage.getItem('mock_firebase_users') || '[]');
    const user = mockUsers.find(u => u.email === email && u.password === password);
    if (!user) {
      throw new Error("Credenciais inválidas ou usuário não cadastrado.");
    }
    currentMockUser = { uid: user.uid, email: user.email };
    localStorage.setItem('mock_firebase_current_user', JSON.stringify(currentMockUser));
    notifyAuthListeners();
    return currentMockUser;
  }
};

export const signUp = async (email, password) => {
  if (isConfigured && auth) {
    const credential = await fbCreateUser(auth, email, password);
    return credential.user;
  } else {
    const mockUsers = JSON.parse(localStorage.getItem('mock_firebase_users') || '[]');
    if (mockUsers.some(u => u.email === email)) {
      throw new Error("Este e-mail já está sendo utilizado.");
    }
    const newUser = {
      uid: 'mock-uid-' + Math.random().toString(36).substr(2, 9),
      email,
      password
    };
    mockUsers.push(newUser);
    localStorage.setItem('mock_firebase_users', JSON.stringify(mockUsers));
    
    currentMockUser = { uid: newUser.uid, email: newUser.email };
    localStorage.setItem('mock_firebase_current_user', JSON.stringify(currentMockUser));
    
    const mockDb = JSON.parse(localStorage.getItem('mock_firebase_db') || '{}');
    mockDb[`users/${newUser.uid}`] = {
      uid: newUser.uid,
      email: newUser.email,
      hasCompletedOnboarding: false,
      ratedMovies: [],
      favorites: [],
      watchlist: []
    };
    localStorage.setItem('mock_firebase_db', JSON.stringify(mockDb));
    
    notifyAuthListeners();
    return currentMockUser;
  }
};

export const logOut = async () => {
  if (isConfigured && auth) {
    await fbSignOut(auth);
  } else {
    currentMockUser = null;
    localStorage.removeItem('mock_firebase_current_user');
    notifyAuthListeners();
  }
};

export const onAuthStateChange = (callback) => {
  if (isConfigured && auth) {
    return fbOnAuthStateChanged(auth, callback);
  } else {
    mockAuthListeners.push(callback);
    callback(currentMockUser);
    return () => {
      const idx = mockAuthListeners.indexOf(callback);
      if (idx !== -1) mockAuthListeners.splice(idx, 1);
    };
  }
};

export const getUserDoc = async (uid) => {
  if (isConfigured && db) {
    const docRef = fbDoc(db, 'users', uid);
    const snap = await fbGetDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } else {
    const mockDb = JSON.parse(localStorage.getItem('mock_firebase_db') || '{}');
    return mockDb[`users/${uid}`] || null;
  }
};

export const saveUserDoc = async (uid, data) => {
  if (isConfigured && db) {
    const docRef = fbDoc(db, 'users', uid);
    await fbSetDoc(docRef, data, { merge: true });
  } else {
    const mockDb = JSON.parse(localStorage.getItem('mock_firebase_db') || '{}');
    const existing = mockDb[`users/${uid}`] || {};
    mockDb[`users/${uid}`] = {
      ...existing,
      ...data,
      uid
    };
    localStorage.setItem('mock_firebase_db', JSON.stringify(mockDb));
  }
};

export { auth, db, isConfigured };
