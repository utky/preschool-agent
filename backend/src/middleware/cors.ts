import { cors } from 'hono/cors'

// productionではbackendがindex.htmlを配信する同一オリジン構成のためCORSは不要
// 開発時のみフロントエンド(Vite dev server)とバックエンドが別オリジンになるため必要
const FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
]

if (process.env.FRONTEND_URL) {
  FRONTEND_ORIGINS.push(process.env.FRONTEND_URL)
}

export const corsMiddleware = cors({
  origin: FRONTEND_ORIGINS,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
})
