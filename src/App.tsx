import { FormEvent, KeyboardEvent, useRef, useState } from 'react'

import { clearVault, getVaultMeta, saveVault, unlockVault } from './lib/vault'

type Message = {
	role: 'user' | 'assistant'
	content: string
}

type OpenAIModel = {
	id: string
}

type WorkspaceView = 'chat' | 'library' | 'explore'
type SettingsSection = 'general' | 'appearance' | 'profile' | 'security' | 'api' | 'storage'

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
	const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('chat')
	const [settingsSection, setSettingsSection] = useState<SettingsSection>('api')
	const [profileMenuOpen, setProfileMenuOpen] = useState(false)
	const [compactMode, setCompactMode] = useState(false)
	const composerRef = useRef<HTMLTextAreaElement>(null)

	function openWorkspaceMode(mode: 'chat' | 'research' | 'design') {
		setWorkspaceView('chat')
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
		setWorkspaceView('chat')
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
					<button className={workspaceView === 'chat' && workspaceMode === 'chat' ? 'active' : ''} onClick={() => openWorkspaceMode('chat')}><span>◎</span>Chat</button>
					<button className={workspaceView === 'chat' && workspaceMode === 'research' ? 'active' : ''} onClick={() => openWorkspaceMode('research')}><span>⌕</span>Research</button>
					<button className={workspaceView === 'chat' && workspaceMode === 'design' ? 'active' : ''} onClick={() => openWorkspaceMode('design')}><span>◇</span>Design</button>
					<button className={workspaceView === 'library' ? 'active' : ''} onClick={() => setWorkspaceView('library')}><span>▤</span>Library</button>
					<button className={workspaceView === 'explore' ? 'active' : ''} onClick={() => setWorkspaceView('explore')}><span>✦</span>Explore</button>
				</nav>
				<div className="side-label">RECENTS</div>
				<button className="recent-item" onClick={() => setWorkspaceView('chat')}>{messages[0]?.content || 'Your first Playbeat conversation'}</button>
				<div className="profile-area">
					{profileMenuOpen && <div className="profile-menu"><button onClick={() => { setSettingsSection('profile'); setSettingsOpen(true); setProfileMenuOpen(false) }}>Profile</button><button onClick={() => { setSettingsSection('api'); setSettingsOpen(true); setProfileMenuOpen(false) }}>API & models</button><button onClick={() => { setSettingsSection('general'); setSettingsOpen(true); setProfileMenuOpen(false) }}>Settings</button></div>}
					<button className="profile-button" onClick={() => setProfileMenuOpen((open) => !open)}><span className="profile-avatar">{(profileName || 'G').slice(0,1).toUpperCase()}</span><span><b>{profileName || 'Guest profile'}</b><small><span className={apiKey ? 'status-dot ready' : 'status-dot'} />{apiKey ? 'OpenAI connected' : vaultMeta ? 'Profile locked' : 'API key needed'}</small></span><span>⌃</span></button>
				</div>
			</aside>

			<section className="kimi-main">
				<header className="kimi-nav">
					<div className="kimi-brand"><span className="kimi-mark">✦</span>Playbeat AI <span className="crumb">/ {workspaceView === 'chat' ? 'Conversation' : workspaceView === 'library' ? 'Library' : 'Explore'}</span></div>
					<div className="top-actions">
						<button className="model-chip model-button" onClick={() => { setSettingsSection('api'); setSettingsOpen(true) }}>{model}</button>
						<button className="gear-btn" onClick={() => setSettingsOpen(true)} aria-label="Open settings" title="Settings">⚙</button>
					</div>
				</header>

				<div className={`chat-scroll ${compactMode ? 'compact' : ''}`}>
					{workspaceView === 'library' && <section className="section-view"><header><span>WORKSPACE</span><h1>Library</h1><p>Your conversations and generated work, together in one place.</p></header><div className="library-grid"><button onClick={() => setWorkspaceView('chat')}><span>◎</span><b>{messages.length ? 'Current conversation' : 'New conversation'}</b><small>{messages.length} messages</small></button><button onClick={() => { setWorkspaceView('chat'); setDraft('Build a complete responsive website in one HTML code block for ') }}><span>▣</span><b>Website project</b><small>Start a build</small></button></div></section>}
					{workspaceView === 'explore' && <section className="section-view"><header><span>DISCOVER</span><h1>Explore</h1><p>Choose a proven workflow and make it yours.</p></header><div className="explore-grid">{[['Research brief','Research this topic, compare reliable sources, and give me a concise brief: '],['Website builder','Build a complete responsive website in one HTML code block for '],['Campaign planner','Create a practical campaign plan for '],['Document editor','Rewrite and improve this document: ']].map(([title,prompt]) => <button key={title} onClick={() => { setWorkspaceView('chat'); setDraft(prompt); requestAnimationFrame(() => composerRef.current?.focus()) }}><span>✦</span><b>{title}</b><small>Open workflow</small></button>)}</div></section>}
					{workspaceView === 'chat' && (messages.length === 0 ? (
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
					))}
				</div>

				{workspaceView === 'chat' && <div className="composer-wrap">
					{error && <div className="error-banner">{error}</div>}
					<form className="composer" onSubmit={sendMessage}>
						<textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Ask anything, or imagine something new..." rows={2} />
						<div className="composer-foot"><button className="model-chip model-button" type="button" onClick={() => { setSettingsSection('api'); setSettingsOpen(true) }}>{model}⌄</button><div><span className="meta">Local history</span><button className="send-btn" type="submit" disabled={busy || !draft.trim()} aria-label="Send message">{busy ? '…' : '↑'}</button></div></div>
					</form>
					<div className="toolbar"><button onClick={() => setDraft('Create a slide outline for ')}>▤ Slides</button><button onClick={() => setDraft('Research ')}>⌕ Deep Research</button><button onClick={() => setDraft('Build a complete responsive website in one HTML code block for ')}>⚒ Build website</button><button onClick={() => setPreviewOpen(true)} disabled={!previewHtml}>▣ Preview</button></div>
				</div>}
			</section>

			{settingsOpen && <div className="settings-page">
				<aside className="settings-nav"><button className="back-button" onClick={() => setSettingsOpen(false)}>← Back to app</button><span>PERSONAL</span>{([['general','General'],['appearance','Appearance'],['profile','Profile'],['security','Security & login'],['api','API & models'],['storage','Storage']] as Array<[SettingsSection,string]>).map(([id,label]) => <button className={settingsSection === id ? 'active' : ''} key={id} onClick={() => setSettingsSection(id)}>{label}</button>)}</aside>
				<section className="settings-content" role="dialog" aria-modal="true" aria-labelledby="settings-title">
					<div className="modal-heading"><div><span className="modal-kicker">SETTINGS</span><h2 id="settings-title">{{general:'General',appearance:'Appearance',profile:'Profile',security:'Security & login',api:'API & models',storage:'Storage'}[settingsSection]}</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
					{error && <div className="error-banner">{error}</div>}
					{settingsSection === 'general' && <div className="setting-list"><div className="setting-row"><span><b>Language</b><small>Language for the app interface</small></span><select aria-label="Language"><option>Auto detect</option><option>English</option></select></div><div className="setting-row"><span><b>Enter to send</b><small>Use Shift + Enter for a new line</small></span><span className="status-label">On</span></div></div>}
					{settingsSection === 'appearance' && <div className="setting-list"><div className="setting-row"><span><b>Theme</b><small>Premium dark workspace</small></span><span className="status-label">Dark</span></div><button className="setting-row" onClick={() => setCompactMode((value) => !value)}><span><b>Compact conversation</b><small>Reduce spacing between messages</small></span><span className={`switch ${compactMode ? 'on' : ''}`} /></button></div>}
					{settingsSection === 'profile' && <div className="setting-list"><label>Profile name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="My profile" /></label><div className="setting-row"><span><b>Connection status</b><small>Your API key is never displayed here</small></span><span className="status-label">{apiKey ? 'Connected' : 'Not connected'}</span></div></div>}
					{settingsSection === 'api' && <><label>API connection<input value={endpoint} readOnly aria-readonly="true" /></label><label>Model{models.length ? <select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option value={item.id} key={item.id}>{item.id}</option>)}</select> : <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4.1-mini" />}</label><label>OpenAI API key<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Enter your OpenAI API key" /></label><button className="secondary-button" onClick={() => void loadModels()} disabled={loadingModels}>{loadingModels ? 'Loading models...' : 'Load available models'}</button></>}
					{settingsSection === 'security' && <><label>Profile password<input type="password" autoComplete="new-password" value={vaultPassword} onChange={(event) => setVaultPassword(event.target.value)} placeholder="At least 8 characters" /></label><label>Keep encrypted key for<select value={vaultDays} onChange={(event) => setVaultDays(event.target.value)}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label><p className="key-note">The key is encrypted on this device and deleted automatically after expiry. Your profile password is never stored.</p>{vaultMeta && <div className="saved-profile"><span><b>{vaultMeta.profileName}</b><small>Expires {new Date(vaultMeta.expiresAt).toLocaleDateString()}</small></span><button onClick={deleteProfile}>Delete</button></div>}<div className="profile-actions"><button className="secondary-button" onClick={() => void unlockProfile()} disabled={!vaultMeta || vaultBusy}>{vaultBusy ? 'Working...' : 'Unlock saved profile'}</button><button className="secondary-button" onClick={() => void saveProfile()} disabled={vaultBusy}>{vaultMeta ? 'Replace saved profile' : 'Save encrypted profile'}</button></div></>}
					{settingsSection === 'storage' && <div className="setting-list"><div className="setting-row"><span><b>Conversation data</b><small>{messages.length} messages in this session</small></span><button className="danger-button" onClick={startNewChat}>Clear</button></div><div className="setting-row"><span><b>Encrypted profile</b><small>Stored only in this browser</small></span><button className="danger-button" onClick={deleteProfile}>Delete</button></div></div>}
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
