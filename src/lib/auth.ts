import { initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, GithubAuthProvider, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, updateProfile, type User } from 'firebase/auth'

export type AuthUser = {
	id: string
	name?: string | null
	email: string
}

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
}

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
const firebaseAuth = configured ? getAuth(initializeApp(firebaseConfig)) : null
const mapUser = (user: User | null): AuthUser | null => user ? { id: user.uid, name: user.displayName, email: user.email ?? '' } : null

export function watchAuth(callback: (user: AuthUser | null) => void) {
	if (!firebaseAuth) { callback(null); return () => undefined }
	return onAuthStateChanged(firebaseAuth, (user) => callback(mapUser(user)))
}

export const authClient = configured && firebaseAuth ? {
	getSession: async () => ({ data: { user: mapUser(firebaseAuth.currentUser) } }),
	signUp: { email: async ({ name, email, password }: { name:string; email:string; password:string }) => {
		const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
		if (name) await updateProfile(credential.user, { displayName: name })
		return { data: { user: mapUser(credential.user) }, error: null }
	} },
	signIn: {
		email: async ({ email, password }: { email:string; password:string }) => {
			const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
			return { data: { user: mapUser(credential.user) }, error: null }
		},
		social: async ({ provider }: { provider:'google'|'github'; callbackURL?:string }) => {
			const selectedProvider = provider === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider()
			const credential = await signInWithPopup(firebaseAuth, selectedProvider)
			return { data: { user: mapUser(credential.user) }, error: null }
		},
	},
	signOut: () => firebaseSignOut(firebaseAuth),
} : null
