const allowedRoutes = new Set(['models', 'responses'])

export async function onRequest({ request, params }) {
	const route = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '')
	if (!allowedRoutes.has(route)) return Response.json({ error: { message: 'Unsupported API route.' } }, { status: 404 })
	if (route === 'models' && request.method !== 'GET') return new Response(null, { status: 405 })
	if (route === 'responses' && request.method !== 'POST') return new Response(null, { status: 405 })

	const authorization = request.headers.get('Authorization')
	if (!authorization?.startsWith('Bearer ')) {
		return Response.json({ error: { message: 'An OpenAI API key is required.' } }, { status: 401 })
	}

	const contentLength = Number(request.headers.get('Content-Length') || 0)
	if (contentLength > 1_000_000) return Response.json({ error: { message: 'Request is too large.' } }, { status: 413 })

	const upstream = await fetch(`https://api.openai.com/v1/${route}`, {
		method: request.method,
		headers: {
			Authorization: authorization,
			...(request.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
		},
		body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
	})

	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
			'Cache-Control': 'no-store',
		},
	})
}
