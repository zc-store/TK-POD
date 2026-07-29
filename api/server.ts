import app from './app.js'
import { initCron } from './services/cronService.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`)
  initCron()
})
