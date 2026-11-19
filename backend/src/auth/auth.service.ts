import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { User } from './user.schema';
import type { AuthUser, JwtPayload } from './auth.interfaces';

const BCRYPT_ROUNDS = 12;
// Compared against when the username does not exist, so response time does not reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);
// Per-account guard against guessing from many IPs (the per-IP throttle alone can be sidestepped).
export const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Creates the single admin account on first start. */
  async onModuleInit(): Promise<void> {
    if ((await this.users.estimatedDocumentCount()) > 0) return;
    const username = this.config.getOrThrow<string>('ADMIN_USERNAME').trim().toLowerCase();
    const password = this.config.getOrThrow<string>('ADMIN_PASSWORD');
    await this.users.create({ username, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
    this.logger.log(`Created admin user "${username}" from ADMIN_USERNAME / ADMIN_PASSWORD`);
  }

  async login(username: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
    const user = await this.users.findOne({ username: username.trim().toLowerCase() }).lean<User>().exec();
    if (user?.lockedUntil && user.lockedUntil > new Date()) throw lockedError(user.lockedUntil);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      if (user) await this.recordFailedLogin(user._id);
      throw new UnauthorizedException('Incorrect username or password');
    }
    if (user.failedLogins || user.lockedUntil) {
      await this.users.updateOne({ _id: user._id }, { $set: { failedLogins: 0 }, $unset: { lockedUntil: 1 } }).exec();
    }
    return { accessToken: await this.sign(user), user: toAuthUser(user) };
  }

  /** Resolves a verified token to its user; rejects tokens issued before a password change. */
  async validatePayload(payload: JwtPayload): Promise<AuthUser> {
    if (!Types.ObjectId.isValid(payload.sub)) throw new UnauthorizedException();
    const user = await this.users.findById(payload.sub).lean<User>().exec();
    if (!user || user.tokenVersion !== payload.ver) throw new UnauthorizedException('Session expired, please log in again');
    return toAuthUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ accessToken: string }> {
    const user = await this.users.findById(userId).exec();
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.tokenVersion += 1;
    await user.save();
    return { accessToken: await this.sign(user.toObject()) };
  }

  /** Counts a wrong password; the MAX_FAILED_LOGINS-th one locks the account for LOCK_MS. */
  private async recordFailedLogin(id: Types.ObjectId): Promise<void> {
    const updated = await this.users
      .findByIdAndUpdate(id, { $inc: { failedLogins: 1 } }, { returnDocument: 'after', projection: { failedLogins: 1 } })
      .lean<Pick<User, 'failedLogins'>>()
      .exec();
    if (updated && updated.failedLogins >= MAX_FAILED_LOGINS) {
      await this.users.updateOne({ _id: id }, { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } }).exec();
      this.logger.warn(`Locked user ${id.toString()} for ${LOCK_MS / 60_000} min after ${MAX_FAILED_LOGINS} wrong passwords`);
    }
  }

  private sign(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user._id.toString(), ver: user.tokenVersion };
    return this.jwt.signAsync(payload);
  }
}

function lockedError(until: Date): HttpException {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return new HttpException(`Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, HttpStatus.TOO_MANY_REQUESTS);
}

function toAuthUser(user: User): AuthUser {
  return { id: user._id.toString(), username: user.username };
}
