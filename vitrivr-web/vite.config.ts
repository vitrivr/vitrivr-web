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
  const mediaOrigin = env.VITE_MEDIA_PATH_ORIGIN || env.VITE_MEDIA_ORIGIN;
  if (mediaOrigin) {
    proxy['/frame-media'] = {
      target: mediaOrigin.match(/^https?:\/\/[^/]+/)?.[0] ?? mediaOrigin,
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
