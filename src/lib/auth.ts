import { createAuthClient } from '@neondatabase/auth'

export const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim() ?? ''
export const authClient = neonAuthUrl ? createAuthClient(neonAuthUrl) : null

export type AuthUser = {
	id: string
	name?: string | null
	email: string
}
