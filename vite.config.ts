import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

type ConnectNext = (err?: unknown) => void

/**
 * Forwards /api/figma/* → https://api.figma.com/*
 * Client sends X-Figma-Token; only use on localhost.
 *
 * Must run on both dev and preview — otherwise /api/figma hits SPA fallback
 * and returns HTML, which causes "Unexpected token '<' ... is not valid JSON".
 */
function createFigmaProxyMiddleware() {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: ConnectNext,
  ): Promise<void> => {
    const url = req.url ?? ''
    if (!url.startsWith('/api/figma')) {
      next()
      return
    }

    const token =
      (req.headers['x-figma-token'] as string | undefined) ||
      (req.headers['X-Figma-Token'] as string | undefined)
    if (!token) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ err: 'Missing X-Figma-Token' }))
      return
    }

    const u = new URL(url, 'http://localhost')
    const path = u.pathname.replace(/^\/api\/figma/, '') || '/'
    const target = `https://api.figma.com${path}${u.search}`

    try {
      const method = req.method || 'GET'
      if (method !== 'GET' && method !== 'HEAD') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ err: 'Only GET and HEAD are supported' }))
        return
      }

      const figmaRes = await fetch(target, {
        method,
        headers: {
          'X-Figma-Token': token,
        },
      })

      res.statusCode = figmaRes.status
      figmaRes.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'content-encoding') return
        res.setHeader(key, value)
      })
      if (!figmaRes.body) {
        res.end()
        return
      }
      const ab = await figmaRes.arrayBuffer()
      res.end(Buffer.from(ab))
    } catch (e) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          err: 'Figma proxy error',
          message: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }
}

function figmaProxyPlugin() {
  const middleware = createFigmaProxyMiddleware()
  return {
    name: 'figma-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig({
  /** Relative asset URLs so opening dist/index.html or hosting under a subpath works */
  base: './',
  plugins: [react(), figmaProxyPlugin()],
  server: {
    /** Opens your default browser when you run `npm run dev` */
    open: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    open: true,
    port: 4173,
    strictPort: false,
  },
})
