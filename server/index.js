require('dotenv').config()

const express = require('express')
const authRoutes = require('./routes/authRoutes')
const clipRoutes = require('./routes/clipRoutes')
const friendRoutes = require('./routes/friendRoutes')
const gameRoutes = require('./routes/gameRoutes')
const groupRoutes = require('./routes/groupRoutes')

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/featured-clips', clipRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/friends', friendRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
