import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private adminEmails(): string[] {
    return (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  private isAdmin(email: string): boolean {
    return this.adminEmails().includes(email.trim().toLowerCase());
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Always resolves (no email enumeration). Only allow-listed emails actually
   * get a code generated and delivered.
   */
  async requestOtp(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    if (!this.isAdmin(email)) {
      // Silently ignore non-admin emails (the client still gets a 200).
      // Logged for ops so "no email arrived" is diagnosable from Render logs.
      this.logger.warn(
        `OTP requested for non-admin email (ignored): ${email} — check ADMIN_EMAILS if this should work`,
      );
      return;
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.adminOtp.create({
      data: { email, codeHash, expiresAt },
    });

    await this.deliverCode(email, code);
  }

  private async deliverCode(email: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');

    if (!apiKey || !from) {
      // Dev fallback — no email provider configured.
      this.logger.warn(
        `RESEND not configured. OTP for ${email} is: ${code} (valid 10 min)`,
      );
      return;
    }

    try {
      const resend = new Resend(apiKey);
      // Resend v4 does NOT throw on API rejections (unverified domain, bad
      // "from", sandbox limits…) — it returns { data, error }. Check both.
      const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject: 'Tu código de acceso a BoscoStore',
        text: `Tu código de acceso es ${code}. Expira en 10 minutos.`,
        html: `<p>Tu código de acceso a <strong>BoscoStore</strong> es:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Expira en 10 minutos.</p>`,
      });

      if (error) {
        this.logger.error(
          `Resend rejected OTP email to ${email} (from: ${from}): ${JSON.stringify(error)}`,
        );
        return;
      }
      this.logger.log(`OTP email sent to ${email} (resend id: ${data?.id})`);
    } catch (err) {
      // Network/unexpected failures. Do not leak to the client; log for ops.
      this.logger.error(
        `Failed to send OTP email to ${email}: ${(err as Error).message}`,
      );
    }
  }

  async verifyOtp(
    rawEmail: string,
    code: string,
  ): Promise<{ accessToken: string; admin: { email: string } }> {
    const email = rawEmail.trim().toLowerCase();

    const otp = await this.prisma.adminOtp.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    await this.prisma.adminOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: email, email },
      {
        secret: this.config.get<string>('JWT_SECRET') ?? 'devsecret',
        expiresIn: '8h',
      },
    );

    return { accessToken, admin: { email } };
  }
}
