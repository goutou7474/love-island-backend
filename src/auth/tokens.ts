import jwt from 'jsonwebtoken'

export interface AuthTokenPayload {
  sub: string
}

export function signAuthToken(userId: string, jwtSecret: string, expiresIn: string) {
  return jwt.sign({ sub: userId }, jwtSecret, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAuthToken(token: string, jwtSecret: string): AuthTokenPayload {
  const payload = jwt.verify(token, jwtSecret)

  if (!payload || typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new Error('Invalid token payload')
  }

  return {
    sub: payload.sub,
  }
}

