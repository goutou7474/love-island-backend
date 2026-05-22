import bcrypt from 'bcryptjs'

const passwordRounds = 12

export async function hashPassword(password: string) {
  return bcrypt.hash(password, passwordRounds)
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash)
}

