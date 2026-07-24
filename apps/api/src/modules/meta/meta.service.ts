import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
}

interface CustomData {
  value: number;
  currency: string;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
}

interface MetaEventInput {
  eventName: string;
  eventId: string;
  eventSourceUrl: string;
  userData: UserData;
  customData: CustomData;
}

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly pixelId: string;
  private readonly accessToken: string;
  private readonly apiVersion = 'v21.0';

  constructor(private readonly configService: ConfigService) {
    this.pixelId = this.configService.get<string>('META_PIXEL_ID') || '';
    this.accessToken = this.configService.get<string>('META_CONVERSIONS_API_ACCESS_TOKEN') || '';
  }

  /**
   * Hash data using SHA-256 as required by Meta CAPI
   */
  private hashData(value: string): string {
    if (!value) return '';
    return crypto
      .createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  /**
   * Normalize phone number according to Meta's requirements
   * E.164 format: country code + number (e.g., +8801XXXXXXXXX)
   */
  private normalizePhone(phone: string): string {
    if (!phone) return '';
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');
    // Add + if it doesn't exist but we have country code
    if (!normalized.startsWith('+') && normalized.length >= 10) {
      // Assume Bangladesh (+880) if not provided
      if (normalized.startsWith('01')) {
        normalized = '+88' + normalized;
      }
    }
    return normalized;
  }

  /**
   * Build user_data object with hashed values
   */
  private buildUserData(userData: UserData): Record<string, string[]> {
    const userDataHashed: Record<string, string[]> = {};

    if (userData.email) {
      userDataHashed.em = [this.hashData(userData.email)];
    }

    if (userData.phone) {
      const normalizedPhone = this.normalizePhone(userData.phone);
      if (normalizedPhone) {
        userDataHashed.ph = [this.hashData(normalizedPhone)];
      }
    }

    if (userData.firstName) {
      userDataHashed.fn = [this.hashData(userData.firstName)];
    }

    if (userData.lastName) {
      userDataHashed.ln = [this.hashData(userData.lastName)];
    }

    if (userData.city) {
      userDataHashed.ct = [this.hashData(userData.city)];
    }

    if (userData.country) {
      userDataHashed.country = [this.hashData(userData.country)];
    }

    // Add client IP and user agent for better matching
    // These should be passed from the request context
    userDataHashed.client_ip_address = [''];
    userDataHashed.client_user_agent = [''];

    return userDataHashed;
  }

  /**
   * Send an event to Meta Conversions API using native fetch
   */
  async sendEvent(input: MetaEventInput): Promise<boolean> {
    // Skip if not configured
    if (!this.pixelId || !this.accessToken) {
      this.logger.warn('Meta CAPI not configured - skipping event');
      return false;
    }

    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events?access_token=${this.accessToken}`;

      const eventTime = Math.floor(Date.now() / 1000);

      const payload = {
        data: [
          {
            event_name: input.eventName,
            event_time: eventTime,
            event_id: input.eventId,
            action_source: 'website',
            event_source_url: input.eventSourceUrl,
            user_data: this.buildUserData(input.userData),
            custom_data: input.customData,
          },
        ],
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok && responseData?.events_received) {
        this.logger.log(
          `Meta CAPI event sent successfully: ${input.eventName} (event_id: ${input.eventId})`,
        );
        return true;
      }

      this.logger.warn(`Meta CAPI response: ${JSON.stringify(responseData)}`);
      return false;
    } catch (error) {
      this.logger.error(`Meta CAPI error: ${error}`);
      return false;
    }
  }

  /**
   * Send Purchase event (most important for conversion tracking)
   */
  async sendPurchaseEvent(
    orderId: string,
    _orderNumber: string,
    value: number,
    currency: string,
    items: Array<{ productId: string; quantity: number }>,
    customerData: UserData,
    eventSourceUrl: string,
  ): Promise<boolean> {
    const eventId = `purchase_${orderId}`;

    return this.sendEvent({
      eventName: 'Purchase',
      eventId,
      eventSourceUrl,
      userData: customerData,
      customData: {
        value,
        currency,
        content_ids: items.map((item) => item.productId),
        content_type: 'product',
        num_items: items.reduce((sum, item) => sum + item.quantity, 0),
        contents: items.map((item) => ({
          id: item.productId,
          quantity: item.quantity,
        })),
      },
    });
  }

  /**
   * Check if Meta CAPI is configured
   */
  isConfigured(): boolean {
    return Boolean(this.pixelId && this.accessToken);
  }
}
