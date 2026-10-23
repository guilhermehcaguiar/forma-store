import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { validateFrontendEnv, privateFilesGuard } from './scripts/frontend-env.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  validateFrontendEnv({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env })
  return {
    plugins: [privateFilesGuard(), react()],
    envPrefix: 'VITE_',
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      watch: { ignored: ['**/.tmp/**', '**/.local/**'] },
      fs: {
        strict: true,
        deny: ['**/.env', '**/.env.*', '**/.git/**', '**/server/**', '**/.local/**', '**/.tmp/**', '**/*.{pem,key,p12,pfx,crt}'],
      },
    },
  }
})
