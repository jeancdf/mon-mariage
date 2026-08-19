import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class InvitationMailerService {
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendAccountInvitation(recipient: { email: string; name: string; token: string }): Promise<void> {
    const applicationUrl = this.config.get<string>('PUBLIC_APP_URL', this.config.get<string>('CLIENT_ORIGIN', ''));
    const from = this.config.get<string>('MAIL_FROM', '');
    if (!applicationUrl || !from) {
      throw new ServiceUnavailableException("L'envoi des invitations n'est pas configuré.");
    }

    const invitationUrl = new URL('/invitation', applicationUrl);
    invitationUrl.searchParams.set('token', recipient.token);
    const safeName = this.escapeHtml(recipient.name || '');
    const safeUrl = this.escapeHtml(invitationUrl.toString());

    try {
      await this.getTransporter().sendMail({
        from,
        to: recipient.email,
        subject: 'Créez votre mot de passe — Mon Mariage',
        text: [
          `Bonjour ${recipient.name || ''},`,
          '',
          'Un accès à l’espace privé Mon Mariage vient de vous être créé.',
          'Choisissez votre mot de passe avec ce lien personnel, valable pendant 48 heures :',
          invitationUrl.toString(),
          '',
          "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
        ].join('\n'),
        html: `
          <div style="margin:0;padding:32px;background:#f5f2ec;color:#25231f;font-family:Arial,sans-serif">
            <div style="max-width:560px;margin:0 auto;padding:32px;background:#fff;border:1px solid #ded8ce;border-radius:12px">
              <p style="margin:0 0 20px;font-size:14px">Bonjour ${safeName},</p>
              <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;font-weight:400">Votre accès Mon Mariage</h1>
              <p style="margin:0 0 24px;line-height:1.6">Un organisateur vient de créer votre compte. Utilisez le bouton ci-dessous pour choisir votre mot de passe. Ce lien personnel est valable pendant 48 heures et ne peut être utilisé qu’une fois.</p>
              <p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:7px;background:#25231f;color:#fff;text-decoration:none">Créer mon mot de passe</a></p>
              <p style="margin:0;color:#777;font-size:12px;line-height:1.5">Si vous n’attendiez pas cette invitation, ignorez simplement cet e-mail.</p>
            </div>
          </div>
        `,
      });
    } catch {
      throw new ServiceUnavailableException("L'e-mail d'invitation n'a pas pu être envoyé. Vérifiez la configuration SMTP.");
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST', '');
    if (!host) throw new ServiceUnavailableException("L'envoi des invitations n'est pas configuré.");
    const user = this.config.get<string>('SMTP_USER', '');
    const pass = this.config.get<string>('SMTP_PASSWORD', '');
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT', '587')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      requireTLS: this.config.get<string>('SMTP_REQUIRE_TLS', 'true') === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character] ?? character);
  }
}
