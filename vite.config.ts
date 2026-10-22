import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	base: '/kimi-playbeat/',
	plugins: [react()],
	css: {
		postcss: { plugins: [] },
	},
})
