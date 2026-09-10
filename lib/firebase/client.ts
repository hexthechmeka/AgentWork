"use client";

// Firebase client SDK singleton. Import this ONLY from client components
// (the login page, the sign-out button) — never from a server component,
// route handler, or server action. For server-side session verification and
// user provisioning, use lib/firebase/admin.ts instead.
//
// Lazily initialized: the real Firebase project isn't configured in every
// environment (e.g. a build/CI run with no NEXT_PUBLIC_FIREBASE_* vars set)
// and initializeApp/getAuth throw immediately on a bad/missing config, so
// eagerly running them at module scope would break `next build`'s static
// prerender of any page that imports this module. Deferring to first use
// means the throw only happens if someone actually tries to sign in
// without Firebase configured.

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, GoogleAuthProvider, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

let cachedApp: FirebaseApp | null = null;
function getFirebaseApp(): FirebaseApp {
  if (!cachedApp) {
    cachedApp = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return cachedApp;
}

let cachedAuth: Auth | null = null;
export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }
  return cachedAuth;
}

export function getGoogleProvider(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}
