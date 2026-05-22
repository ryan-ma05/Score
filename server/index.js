require('dotenv').config()

const http = require('http')
const path = require('path')
const express = require('express')
const cors = require('cors')
const { Server: SocketServer } = require('socket.io')
const authRoutes = require('./routes/authRoutes')
const clipRoutes = require('./routes/clipRoutes')
const friendRoutes = require('./routes/friendRoutes')
const gameRoutes = require('./routes/gameRoutes')
const groupRoutes = require('./routes/groupRoutes')
const uploadRoutes = require('./routes/uploadRoutes')
const userRoutes = require('./routes/userRoutes')
const tournamentRoutes = require('./routes/tournamentRoutes')
const { runMigrations } = require('./migrations')
runMigrations()
require('./seed')

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 3001

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173']

const corsOptions = {
  origin: (origin, callback) => {
    // allow server-to-server / curl calls (no origin header)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json())

const io = new SocketServer(server, { cors: corsOptions })

// attach io to every request so routes can emit events
app.use((req, _res, next) => {
  req.io = io
  next()
})

// Socket.io session rooms — clients join "session:<id>" to receive live score updates
io.on('connection', (socket) => {
  socket.on('join-session', (sessionId) => {
    socket.join(`session:${sessionId}`)
  })
  socket.on('leave-session', (sessionId) => {
    socket.leave(`session:${sessionId}`)
  })
})

app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/games', gameRoutes)
app.use('/api/featured-clips', clipRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/friends', friendRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/users', userRoutes)
app.use('/api/groups/:id/tournaments', tournamentRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
