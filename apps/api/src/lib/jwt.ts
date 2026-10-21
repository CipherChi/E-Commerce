import jwt = require('jsonwebtoken');

export interface JwtPort {
  signAsync(payload: object, options: { secret: string; expiresIn?: string }): Promise<string>;
  verifyAsync<T = unknown>(token: string, options: { secret: string }): Promise<T>;
}

export class JwtAdapter implements JwtPort {
  async signAsync(payload: object, options: { secret: string; expiresIn?: string }) {
    return jwt.sign(payload, options.secret, { expiresIn: options.expiresIn as jwt.SignOptions['expiresIn'] });
  }
  async verifyAsync<T = unknown>(token: string, options: { secret: string }): Promise<T> {
    return jwt.verify(token, options.secret) as T;
  }
}
