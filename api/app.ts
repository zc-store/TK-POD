import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import newsRoutes from './routes/news.js'
import patternRoutes from './routes/patterns.js'
import productRoutes from './routes/products.js'
import tiktokRoutes from './routes/tiktok.js'
import imageRoutes from './routes/image.js'
import cronRoutes from './routes/cron.js'
import connectDB from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

connectDB()

app.use('/images', express.static(path.join(__dirname, '../images')))
app.use('/api/auth', authRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/patterns', patternRoutes)
app.use('/api/products', productRoutes)
app.use('/api/tiktok', tiktokRoutes)
app.use('/api/image', imageRoutes)
app.use('/api/cron', cronRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app