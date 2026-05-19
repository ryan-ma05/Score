const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

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
