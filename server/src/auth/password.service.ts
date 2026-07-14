import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  validate(password: string): void {
    if (typeof password !== 'string' || password.length < 12) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 12 caractères.');
    }
    if (password.length > 256) {
      throw new BadRequestException('Le mot de passe est trop long.');
    }
  }

  async hash(password: string): Promise<string> {
    this.validate(password);
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
    return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
  }

  async verify(password: string, storedHash: string | null): Promise<boolean> {
    if (!storedHash || typeof password !== 'string') return false;
    const [algorithm, saltValue, hashValue] = storedHash.split(':');
    if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
    try {
      const expected = Buffer.from(hashValue, 'base64');
      const actual = await scrypt(password, Buffer.from(saltValue, 'base64'), expected.length) as Buffer;
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
}

