import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  id: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null = null;
  private readonly fromAddress: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const fromEmail = this.config.get<string>('RESEND_FROM_EMAIL') || 'noreply@denimisia.online';
    const fromName = this.config.get<string>('RESEND_FROM_NAME') || 'Denimisia';

    this.isConfigured = !!apiKey;
    this.client = apiKey ? new Resend(apiKey) : null;
    this.fromAddress = `${fromName} <${fromEmail}>`;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.client || !this.isConfigured) {
      this.logger.warn(
        `Email not sent (Resend not configured): ${input.subject} to ${input.to}`,
      );
      return { id: 'mock-email-id' };
    }

    const payload = {
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    };

    const { data, error } = await this.client.emails.send(payload);

    if (error || !data) {
      this.logger.error(
        { error, to: input.to, subject: input.subject },
        'Resend send failed',
      );
      throw new Error(
        `Resend send failed: ${error?.message ?? 'no data returned'}`,
      );
    }

    return { id: data.id };
  }
}
