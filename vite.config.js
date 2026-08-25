import { defineConfig, loadEnv } from 'vite'

/**
 * 開発サーバーでも /api/analyze を動かすためのプラグイン。
 * 本番では同じ api/analyze.js を Vercel Functions が実行する。
 */
function vercelApiDev() {
  return {
    name: 'vercel-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res, next) => {
        if (req.method !== 'POST') return next()

        try {
          const { default: handler } = await server.ssrLoadModule('/api/analyze.js')

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)

          // Node の headers は配列を含むことがあるので文字列だけ渡す
          const headers = {}
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers[key] = value
          }

          const request = new Request('http://localhost/api/analyze', {
            method: 'POST',
            headers,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          })

          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.config.logger.error(`[vercel-api-dev] ${err.stack || err}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Dev API handler failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Edge Function は process.env を読むので、開発時は .env から流し込む
  const env = loadEnv(mode, process.cwd(), '')
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  }

  return {
    base: '/', // Vercelはルート配信
    plugins: [vercelApiDev()],
  }
})
