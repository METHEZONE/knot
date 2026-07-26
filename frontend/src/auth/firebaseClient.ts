import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";

let emulatorConnected = false;

export function firebaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
}

export function authConfigurationError() {
  return "Firebase Auth 환경변수가 설정되지 않았습니다. NEXT_PUBLIC_FIREBASE_* 값을 확인해주세요.";
}

export function firebaseAuth(): Auth {
  if (!firebaseConfigured()) {
    throw new Error(authConfigurationError());
  }
  const auth = getAuth(firebaseApp());
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost && !emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    emulatorConnected = true;
  }
  return auth;
}

export async function currentIdToken() {
  const user = firebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}

export async function signInWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(firebaseAuth(), email, password);
  return credential.user;
}

export async function createFirebaseAccount(email: string, password: string, displayName: string) {
  const credential = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return credential.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(firebaseAuth(), provider);
  return credential.user;
}

export async function signOutFirebase() {
  await signOut(firebaseAuth());
}

export function observeFirebaseUser(onChange: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth(), onChange);
}

function firebaseApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}
