import { BadRequestException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
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
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Incorrect username or password');
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

  private sign(user: User): Promise<string> {
    const payload: JwtPayload = { sub: user._id.toString(), username: user.username, ver: user.tokenVersion };
    return this.jwt.signAsync(payload);
  }
}

function toAuthUser(user: User): AuthUser {
  return { id: user._id.toString(), username: user.username };
}
