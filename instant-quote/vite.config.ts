import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    // The Go backend owns /api (see ../backend); Nitro handles requests
    // ahead of Vite's own proxy, so the forwarding lives in its routeRules.
    // Works in dev and as a production fallback — though in production the
    // reverse proxy should route /api to the Go service directly.
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      routeRules: {
        '/api/**': {
          proxy: `${process.env.API_PROXY ?? 'http://localhost:8080'}/api/**`,
        },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
