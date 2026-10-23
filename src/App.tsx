import { FormEvent, KeyboardEvent, useRef, useState } from 'react'

import { clearVault, getVaultMeta, saveVault, unlockVault } from './lib/vault'

type Message = {
	role: 'user' | 'assistant'
	content: string
}

type OpenAIModel = {
	id: string
}

const defaultEndpoint = '/api/openai'

function extractHtml(messages: Message[]) {
	const answer = [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? ''
	const fenced = answer.match(/```html\s*([\s\S]*?)```/i)
	if (fenced?.[1]) return fenced[1]
	const documentStart = answer.search(/<!doctype html|<html[\s>]/i)
	return documentStart >= 0 ? answer.slice(documentStart) : ''
}

function LandingPage({ onStart }: { onStart: () => void }) {
	return (
		<main className="landing-page">
			<nav className="landing-nav">
				<div className="kimi-brand"><span className="kimi-mark">P</span>Playbeat AI</div>
				<div className="landing-links"><a href="#capabilities">Capabilities</a><button onClick={onStart}>Open workspace</button></div>
				<button className="btn-gold" onClick={onStart}>Start creating</button>
			</nav>
			<section className="landing-hero">
				<span className="eyebrow">Your AI creative co-pilot</span>
				<h1>Your next big idea, further and faster</h1>
				<p>Playbeat AI brings research, writing, planning, and design into one focused space, so the idea in your head becomes something you can use.</p>
				<div className="hero-actions"><button className="btn-gold" onClick={onStart}>Start creating - free</button><a className="btn-ghost" href="#capabilities">See what it can do</a></div>
			</section>
			<section className="landing-preview" aria-label="Product preview">
				<div><span>Ask anything, or imagine something new...</span><button onClick={onStart} aria-label="Open workspace">↑</button></div>
			</section>
			<section className="capabilities" id="capabilities">
				<header><h2>One workspace, every medium</h2><p>Each tool shares the same conversation, so your ideas keep their context.</p></header>
				<div className="cap-grid">
					{[['▤','Slides','Shape ideas into a clear presentation outline.'],['▧','Docs','Write, structure, and refine long-form work.'],['⊞','Analysis','Reason through data and organize findings.'],['◇','Design','Develop concepts, briefs, and visual directions.'],['⌕','Research','Go deeper with structured questions and answers.'],['⚒','Build','Turn a working idea into a practical plan.']].map(([icon,title,copy]) => <article className="cap-card" key={title}><span>{icon}</span><h3>{title}</h3><p>{copy}</p></article>)}
				</div>
			</section>
			<section className="landing-cta"><h2>Ready to think bigger?</h2><p>A little curiosity. Endless possibility.</p><button className="btn-gold" onClick={onStart}>Start your first conversation</button></section>
			<footer>© 2026 Playbeat AI, part of PlayBeat Digital.</footer>
		</main>
	)
}

function App() {
	const [showLanding, setShowLanding] = useState(true)
	const [messages, setMessages] = useState<Message[]>([])
	const [draft, setDraft] = useState('')
	const [apiKey, setApiKey] = useState('')
	const [model, setModel] = useState('gpt-4.1-mini')
	const [endpoint, setEndpoint] = useState(defaultEndpoint)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [busy, setBusy] = useState(false)
	const [models, setModels] = useState<OpenAIModel[]>([])
	const [loadingModels, setLoadingModels] = useState(false)
	const [error, setError] = useState('')
	const [vaultMeta, setVaultMeta] = useState(getVaultMeta)
	const [profileName, setProfileName] = useState(() => getVaultMeta()?.profileName ?? '')
	const [vaultPassword, setVaultPassword] = useState('')
	const [vaultDays, setVaultDays] = useState('7')
	const [vaultBusy, setVaultBusy] = useState(false)
	const [previewOpen, setPreviewOpen] = useState(false)
	const [workspaceMode, setWorkspaceMode] = useState<'chat' | 'research' | 'design'>('chat')
	const composerRef = useRef<HTMLTextAreaElement>(null)

	function openWorkspaceMode(mode: 'chat' | 'research' | 'design') {
		setWorkspaceMode(mode)
		if (mode === 'research') setDraft('Research this topic in depth: ')
		if (mode === 'design') setDraft('Help me design ')
		requestAnimationFrame(() => composerRef.current?.focus())
	}

	async function saveProfile() {
		if (!profileName.trim() || !apiKey.trim() || vaultPassword.length < 8) {
			setError('Enter a profile name, API key, and a profile password of at least 8 characters.')
			return
		}
		setVaultBusy(true)
		try {
			const expiresAt = Date.now() + Number(vaultDays) * 86_400_000
			await saveVault({ profileName: profileName.trim(), apiKey: apiKey.trim(), endpoint, model, expiresAt }, vaultPassword)
			setVaultMeta({ profileName: profileName.trim(), expiresAt })
			setVaultPassword('')
			setError('')
		} finally {
			setVaultBusy(false)
		}
	}

	async function unlockProfile() {
		if (!vaultPassword) {
			setError('Enter your profile password to unlock the saved key.')
			return
		}
		setVaultBusy(true)
		try {
			const saved = await unlockVault(vaultPassword)
			setProfileName(saved.profileName)
			setApiKey(saved.apiKey)
			setEndpoint(saved.endpoint === 'https://api.openai.com/v1' ? defaultEndpoint : saved.endpoint)
			setModel(saved.model)
			setVaultPassword('')
			setError('')
		} catch (vaultError) {
			setError(vaultError instanceof Error ? vaultError.message : 'Could not unlock the profile.')
		} finally {
			setVaultBusy(false)
		}
	}

	function deleteProfile() {
		clearVault()
		setVaultMeta(null)
		setProfileName('')
		setVaultPassword('')
		setApiKey('')
		setModels([])
		setError('')
	}

	async function loadModels() {
		if (!apiKey.trim()) {
			setError('Enter your OpenAI API key before loading models.')
			return
		}

		setLoadingModels(true)
		setError('')
		try {
			const response = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
				headers: { Authorization: `Bearer ${apiKey.trim()}` },
			})
			const result = await response.json()
			if (!response.ok) {
				throw new Error(result.error?.message || `Could not load models (${response.status})`)
			}
			const available = Array.isArray(result.data)
				? result.data.filter((item: unknown): item is OpenAIModel => (
					typeof item === 'object' && item !== null && typeof (item as OpenAIModel).id === 'string'
				)).sort((a: OpenAIModel, b: OpenAIModel) => a.id.localeCompare(b.id))
				: []
			setModels(available)
			if (available.length && !available.some((item: OpenAIModel) => item.id === model)) {
				setModel(available[0].id)
			}
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Could not load OpenAI models.')
		} finally {
			setLoadingModels(false)
		}
	}

	async function sendMessage(event?: FormEvent) {
		event?.preventDefault()
		const content = draft.trim()
		if (!content || busy) return
		if (!apiKey.trim()) {
			setSettingsOpen(true)
			setError('Add your OpenAI API key in settings to start a chat.')
			return
		}

		const conversation = [...messages, { role: 'user' as const, content }]
		setMessages(conversation)
		setDraft('')
		setError('')
		setBusy(true)

		try {
			const response = await fetch(`${endpoint.replace(/\/$/, '')}/responses`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey.trim()}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ model, input: conversation }),
			})
			const result = await response.json()
			if (!response.ok) {
				throw new Error(result.error?.message || `Request failed (${response.status})`)
			}
			const answer = result.output_text ?? result.output
				?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
				.find((item: { type?: string; text?: string }) => item.type === 'output_text')?.text
			if (typeof answer !== 'string') throw new Error('The API returned no message.')
			setMessages([...conversation, { role: 'assistant', content: answer }])
		} catch (requestError) {
			setMessages(conversation)
			setError(requestError instanceof Error ? requestError.message : 'The request failed.')
		} finally {
			setBusy(false)
		}
	}

	function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			void sendMessage()
		}
	}

	function startNewChat() {
		setMessages([])
		setDraft('')
		setError('')
		setWorkspaceMode('chat')
		requestAnimationFrame(() => composerRef.current?.focus())
	}

	const previewHtml = extractHtml(messages)

	if (showLanding) return <LandingPage onStart={() => setShowLanding(false)} />

	return (
		<main className="kimi-shell">
			<aside className="kimi-sidebar">
				<button className="side-brand" onClick={() => setShowLanding(true)}><span className="kimi-mark">P</span><span><b>Playbeat AI</b><small>YOUR CREATIVE CO-PILOT</small></span></button>
				<button className="new-convo" onClick={startNewChat}><span>+ New conversation</span><span className="kbd">Ctrl K</span></button>
				<nav className="side-nav" aria-label="Workspace">
					<button className={workspaceMode === 'chat' ? 'active' : ''} onClick={() => openWorkspaceMode('chat')}><span>◎</span>Chat</button>
					<button className={workspaceMode === 'research' ? 'active' : ''} onClick={() => openWorkspaceMode('research')}><span>⌕</span>Research</button>
					<button className={workspaceMode === 'design' ? 'active' : ''} onClick={() => openWorkspaceMode('design')}><span>◇</span>Design</button>
					<button onClick={() => setSettingsOpen(true)}><span>⚙</span>Settings</button>
				</nav>
				<div className="side-label">YOUR WORKSPACE</div>
				<div className="side-item"><span className="sw" />OpenAI workspace</div>
				<div className="connection"><span className={apiKey ? 'status-dot ready' : 'status-dot'} />{apiKey ? `${profileName || 'Session'} connected` : vaultMeta ? `${vaultMeta.profileName} locked` : 'API key needed'}</div>
			</aside>

			<section className="kimi-main">
				<header className="kimi-nav">
					<div className="kimi-brand"><span className="kimi-mark">✦</span>Playbeat AI <span className="crumb">/ New conversation</span></div>
					<div className="top-actions">
						<span className="model-chip">{model}</span>
						<button className="gear-btn" onClick={() => setSettingsOpen(true)} aria-label="Open settings" title="Settings">⚙</button>
					</div>
				</header>

				<div className="chat-scroll">
					{messages.length === 0 ? (
						<div className="empty-state">
							<section className="hero"><div className="eyebrow-mark">✧</div><h1>A space for your next big idea</h1><p>A little curiosity, endless possibility. Think it, explore it, bring it to life.</p></section>
							<div className="spark-head"><h2>A spark to get you started</h2><span>Choose a direction</span></div>
							<div className="card-row">
								<button className="spark-card" onClick={() => setDraft('Turn this rough idea into a practical plan: ')}><span>✦</span><strong>Make something</strong><small>Turn a rough idea into a brilliant plan.</small></button>
								<button className="spark-card" onClick={() => setDraft('Research and explain this clearly: ')}><span>⌕</span><strong>Go a little deeper</strong><small>Make the complex feel simple.</small></button>
								<button className="spark-card" onClick={() => setDraft('Help me improve this draft: ')}><span>↗</span><strong>Find your words</strong><small>A fresh perspective on your next draft.</small></button>
							</div>
						</div>
					) : (
						<div className="message-list">
							{messages.map((message, index) => (
								<article className={`message ${message.role}`} key={`${index}-${message.role}`}>
									<div className="message-avatar">{message.role === 'user' ? 'Y' : 'AI'}</div>
									<div className="message-body"><div className="message-author">{message.role === 'user' ? 'You' : 'OpenAI'}</div><p>{message.content}</p></div>
								</article>
							))}
							{busy && <div className="thinking"><span /><span /><span /> OpenAI is thinking</div>}
							<div className="end-anchor" />
						</div>
					)}
				</div>

				<div className="composer-wrap">
					{error && <div className="error-banner">{error}</div>}
					<form className="composer" onSubmit={sendMessage}>
						<textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Ask anything, or imagine something new..." rows={2} />
						<div className="composer-foot"><span className="model-chip">{model}</span><div><span className="meta">Local history</span><button className="send-btn" type="submit" disabled={busy || !draft.trim()} aria-label="Send message">{busy ? '…' : '↑'}</button></div></div>
					</form>
					<div className="toolbar"><button onClick={() => setDraft('Create a slide outline for ')}>▤ Slides</button><button onClick={() => setDraft('Research ')}>⌕ Deep Research</button><button onClick={() => setDraft('Build a complete responsive website in one HTML code block for ')}>⚒ Build website</button><button onClick={() => setPreviewOpen(true)} disabled={!previewHtml}>▣ Preview</button></div>
				</div>
			</section>

			{settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
				<section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
					<div className="modal-heading"><div><span className="modal-kicker">CONNECTION</span><h2 id="settings-title">Model settings</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
					{error && <div className="error-banner">{error}</div>}
					<label>API connection<input value={endpoint} readOnly aria-readonly="true" /></label>
					<label>Model<input list="openai-models" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4.1-mini" /></label>
					<datalist id="openai-models">{models.map((item) => <option value={item.id} key={item.id} />)}</datalist>
					<label>OpenAI API key<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Enter your OpenAI API key" /></label>
					<div className="profile-divider"><span>ENCRYPTED PROFILE</span></div>
					<label>Profile name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="My profile" /></label>
					<label>Profile password<input type="password" autoComplete="new-password" value={vaultPassword} onChange={(event) => setVaultPassword(event.target.value)} placeholder="At least 8 characters" /></label>
					<label>Keep encrypted key for<select value={vaultDays} onChange={(event) => setVaultDays(event.target.value)}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label>
					<p className="key-note">The key is encrypted on this device and deleted automatically after expiry. Your profile password is never stored.</p>
					{vaultMeta && <div className="saved-profile"><span><b>{vaultMeta.profileName}</b><small>Expires {new Date(vaultMeta.expiresAt).toLocaleDateString()}</small></span><button onClick={deleteProfile}>Delete</button></div>}
					<div className="profile-actions"><button className="secondary-button" onClick={() => void unlockProfile()} disabled={!vaultMeta || vaultBusy}>{vaultBusy ? 'Working...' : 'Unlock saved profile'}</button><button className="secondary-button" onClick={() => void saveProfile()} disabled={vaultBusy}>{vaultMeta ? 'Replace saved profile' : 'Save encrypted profile'}</button></div>
					<button className="secondary-button" onClick={() => void loadModels()} disabled={loadingModels}>{loadingModels ? 'Loading models...' : 'Load available models'}</button>
					<button className="save-button" onClick={() => { setSettingsOpen(false); setError('') }}>Done <span>→</span></button>
				</section>
			</div>}
				{previewOpen && <div className="preview-backdrop">
					<section className="website-preview" role="dialog" aria-modal="true" aria-label="Website preview">
						<header><div><span>WEBSITE PREVIEW</span><b>Sandboxed output</b></div><button onClick={() => setPreviewOpen(false)} aria-label="Close preview">×</button></header>
						<iframe title="Generated website preview" sandbox="allow-scripts" srcDoc={previewHtml} />
					</section>
				</div>}
		</main>
	)
}

export default App
