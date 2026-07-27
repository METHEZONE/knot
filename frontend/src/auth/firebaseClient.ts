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
let googleProvider: GoogleAuthProvider | null = null;

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
  try {
    const credential = await signInWithPopup(firebaseAuth(), googleAuthProvider());
    return credential.user;
  } catch (error) {
    if (
      isFirebaseAuthCode(error, "auth/unauthorized-domain") &&
      typeof window !== "undefined" &&
      process.env.NODE_ENV !== "production"
    ) {
      console.error(
        `[Firebase Auth] Add "${window.location.hostname}" to Firebase Authentication > Settings > Authorized domains.`,
      );
    }
    throw error;
  }
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

function googleAuthProvider() {
  googleProvider ??= new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });
  return googleProvider;
}

export function firebaseAuthErrorMessage(error: unknown) {
  if (isFirebaseAuthCode(error, "auth/unauthorized-domain")) {
    return "현재 접속한 도메인이 Firebase 로그인 허용 목록에 등록되지 않았습니다.";
  }
  if (isFirebaseAuthCode(error, "auth/popup-closed-by-user")) {
    return "로그인 창이 닫혔습니다. 다시 시도해주세요.";
  }
  if (isFirebaseAuthCode(error, "auth/popup-blocked")) {
    return "브라우저가 로그인 팝업을 차단했습니다. 팝업을 허용해주세요.";
  }
  if (isFirebaseAuthCode(error, "auth/network-request-failed")) {
    return "네트워크 연결을 확인해주세요.";
  }
  return error instanceof Error ? error.message : String(error);
}

function isFirebaseAuthCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
