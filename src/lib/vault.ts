const VAULT_KEY = 'playbeat-openai-vault-v1'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type VaultPayload = {
	profileName: string
	apiKey: string
	endpoint: string
	model: string
	expiresAt: number
}

type StoredVault = {
	profileName: string
	expiresAt: number
	salt: string
	iv: string
	ciphertext: string
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = ''
	bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
	return btoa(binary)
}

function base64ToBytes(value: string) {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function deriveKey(password: string, salt: Uint8Array) {
	const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations: 250_000, hash: 'SHA-256' },
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	)
}

export function clearVault() {
	localStorage.removeItem(VAULT_KEY)
}

export function getVaultMeta() {
	const raw = localStorage.getItem(VAULT_KEY)
	if (!raw) return null
	try {
		const vault = JSON.parse(raw) as StoredVault
		if (vault.expiresAt <= Date.now()) {
			clearVault()
			return null
		}
		return { profileName: vault.profileName, expiresAt: vault.expiresAt }
	} catch {
		clearVault()
		return null
	}
}

export async function saveVault(payload: VaultPayload, password: string) {
	const salt = crypto.getRandomValues(new Uint8Array(16))
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const key = await deriveKey(password, salt)
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(payload)))
	const stored: StoredVault = {
		profileName: payload.profileName,
		expiresAt: payload.expiresAt,
		salt: bytesToBase64(salt),
		iv: bytesToBase64(iv),
		ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
	}
	localStorage.setItem(VAULT_KEY, JSON.stringify(stored))
}

export async function unlockVault(password: string) {
	const raw = localStorage.getItem(VAULT_KEY)
	if (!raw) throw new Error('No saved profile was found.')
	const stored = JSON.parse(raw) as StoredVault
	if (stored.expiresAt <= Date.now()) {
		clearVault()
		throw new Error('This saved profile has expired and was removed.')
	}
	try {
		const key = await deriveKey(password, base64ToBytes(stored.salt))
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: base64ToBytes(stored.iv) },
			key,
			base64ToBytes(stored.ciphertext),
		)
		return JSON.parse(decoder.decode(plaintext)) as VaultPayload
	} catch {
		throw new Error('The profile password is incorrect.')
	}
}
