import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Admin guard used by all write endpoints. Requires a valid Bearer JWT.
 * Tokens are only ever issued to allow-listed admin emails via the OTP flow,
 * so a valid token is sufficient to authorize admin writes.
 */
@Injectable()
export class AdminGuard extends AuthGuard('jwt') {}
