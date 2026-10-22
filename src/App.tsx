import { FormEvent, KeyboardEvent, useState } from 'react'

type Message = {
	role: 'user' | 'assistant'
	content: string
}

type OpenAIModel = {
	id: string
}

const defaultEndpoint = 'https://api.openai.com/v1'

function App() {
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
	}

	return (
		<main className="kimi-shell">
			<aside className="kimi-sidebar">
				<div className="side-brand"><span className="kimi-mark">P</span><div><b>Playbeat AI</b><small>YOUR CREATIVE CO-PILOT</small></div></div>
				<button className="new-convo" onClick={startNewChat}><span>+ New conversation</span><span className="kbd">Ctrl K</span></button>
				<nav className="side-nav" aria-label="Workspace">
					<button className="active"><span>◎</span>Chat</button>
					<button onClick={() => setDraft('Research this topic in depth: ')}><span>⌕</span>Research</button>
					<button onClick={() => setDraft('Help me design ')}><span>◇</span>Design</button>
					<button onClick={() => setSettingsOpen(true)}><span>⚙</span>Settings</button>
				</nav>
				<div className="side-label">YOUR WORKSPACE</div>
				<div className="side-item"><span className="sw" />OpenAI workspace</div>
				<div className="connection"><span className={apiKey ? 'status-dot ready' : 'status-dot'} />{apiKey ? 'API connected' : 'API key needed'}</div>
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
						<textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Ask anything, or imagine something new..." rows={2} />
						<div className="composer-foot"><span className="model-chip">{model}</span><div><span className="meta">Local history</span><button className="send-btn" type="submit" disabled={busy || !draft.trim()} aria-label="Send message">{busy ? '…' : '↑'}</button></div></div>
					</form>
					<div className="toolbar"><button onClick={() => setDraft('Create a slide outline for ')}>▤ Slides</button><button onClick={() => setDraft('Research ')}>⌕ Deep Research</button><button onClick={() => setDraft('Build ')}>⚒ Build</button><button onClick={() => setDraft('Draft a document about ')}>▧ Docs</button></div>
				</div>
			</section>

			{settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
				<section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
					<div className="modal-heading"><div><span className="modal-kicker">CONNECTION</span><h2 id="settings-title">Model settings</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
					<label>API endpoint<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={defaultEndpoint} /></label>
					<label>Model<input list="openai-models" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4.1-mini" /></label>
					<datalist id="openai-models">{models.map((item) => <option value={item.id} key={item.id} />)}</datalist>
					<label>OpenAI API key<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Enter your OpenAI API key" /></label>
					<p className="key-note">Your key stays in this browser session and is sent directly to the configured API.</p>
					<button className="secondary-button" onClick={() => void loadModels()} disabled={loadingModels}>{loadingModels ? 'Loading models...' : 'Load available models'}</button>
					<button className="save-button" onClick={() => { setSettingsOpen(false); setError('') }}>Done <span>→</span></button>
				</section>
			</div>}
		</main>
	)
}

export default App
