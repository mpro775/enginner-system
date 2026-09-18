import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  isWithinBcryptPasswordLimit,
  PASSWORD_HASH_ROUNDS,
} from '../../common/security/password-policy';

@Injectable()
export class PasswordSecurityService {
  hash(password: string): Promise<string> {
    if (!isWithinBcryptPasswordLimit(password)) {
      throw new BadRequestException(
        'يجب ألا تتجاوز كلمة المرور 72 بايت بترميز UTF-8.',
      );
    }
    return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async assertDifferent(password: string, currentHash: string): Promise<void> {
    if (await this.compare(password, currentHash)) {
      throw new BadRequestException(
        'يجب أن تكون كلمة المرور الجديدة مختلفة عن الحالية.',
      );
    }
  }
}
