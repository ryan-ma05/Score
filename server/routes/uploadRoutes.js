const path = require('path')
const fs = require('fs')
const { Router } = require('express')
const multer = require('multer')
const { requireAuth } = require('../middleware')

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
])

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true)
    cb(new Error('Only video files are accepted (mp4, webm, ogg, mov, avi)'))
  },
})

const router = Router()
router.use(requireAuth)

// POST /api/upload — upload a video file, returns a URL to use in clip submissions
router.post('/', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' })
  }

  const url = `/uploads/${req.file.filename}`
  return res.status(201).json({ url })
})

module.exports = router
