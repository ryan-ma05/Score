const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const DEFAULT_SECRET = 'dev-secret-change-me'
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET)) {
  throw new Error('JWT_SECRET must be set to a strong secret in production')
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 12)
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken }
