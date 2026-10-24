import {defineConfig, loadEnv, type ProxyOptions} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, ".", '')
  const proxy: Record<string, ProxyOptions> = env.VITE_PYTHON_DESCRIPTOR_SERVER ? {
    '/descriptor-api': {
      target: env.VITE_PYTHON_DESCRIPTOR_SERVER,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/descriptor-api/, ''),
    },
  } : {}
  if (env.VITE_MEDIA_PATH_ORIGIN) {
    proxy['/frame-media'] = {
      target: env.VITE_MEDIA_PATH_ORIGIN.match(/^https?:\/\/[^/]+/)?.[0] ?? env.VITE_MEDIA_PATH_ORIGIN,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/frame-media/, ''),
    }
  }
  return {
    plugins: [react()],
    // Same-origin extraction avoids relying on descriptor-server browser CORS.
    server: {proxy},
    preview: {proxy},
  }
})
