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
    const allowlist = this.adminEmails();
    this.logger.log(
      `[1/3] requestOtp for ${email} — allowlist has ${allowlist.length} entr${allowlist.length === 1 ? 'y' : 'ies'}`,
    );

    if (!this.isAdmin(email)) {
      // Silently ignore non-admin emails (the client still gets a 200).
      // Logged for ops so "no email arrived" is diagnosable from Render logs.
      this.logger.warn(
        `[1/3] ✗ ${email} is NOT in ADMIN_EMAILS — no code generated. Check the env value (comma-separated, no spaces issues)`,
      );
      return;
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const otp = await this.prisma.adminOtp.create({
      data: { email, codeHash, expiresAt },
    });
    this.logger.log(
      `[2/3] OTP row created (id: ${otp.id}, expires: ${expiresAt.toISOString()}) — delivering…`,
    );

    await this.deliverCode(email, code);
  }

  private async deliverCode(email: string, code: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM');
    this.logger.log(
      `[3/3] Resend config — apiKey: ${apiKey ? `set (${apiKey.length} chars, "${apiKey.slice(0, 5)}…")` : 'MISSING'}, from: ${from ? `"${from}"` : 'MISSING'}, to: ${email}`,
    );

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
          `[3/3] ✗ Resend REJECTED the email (from: ${from}, to: ${email}): ${JSON.stringify(error)}`,
        );
        return;
      }
      this.logger.log(
        `[3/3] ✓ OTP email accepted by Resend (id: ${data?.id}) — if it doesn't arrive, check Resend dashboard → Emails, spam folder, and that the mailbox exists`,
      );
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
      this.logger.warn(
        `verifyOtp: no active (unconsumed, unexpired) code found for ${email}`,
      );
      throw new UnauthorizedException('Código inválido o expirado');
    }

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (!matches) {
      this.logger.warn(
        `verifyOtp: code mismatch for ${email} (otp row: ${otp.id})`,
      );
      throw new UnauthorizedException('Código inválido o expirado');
    }

    await this.prisma.adminOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
    this.logger.log(`verifyOtp: ✓ ${email} authenticated (otp: ${otp.id})`);

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
