import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  storeId: string;
}

interface PathaoToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface CreateConsignmentPayload {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  city: string;
  zone: string;
  weight: number;
  description: string;
  codAmount: number;
  quantity: number;
}

interface PathaoResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

@Injectable()
export class PathaoService {
  private readonly logger = new Logger(PathaoService.name);
  private config: PathaoConfig;
  private token: PathaoToken | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.config = {
      baseUrl: this.configService.get('PATHAO_BASE_URL') || 'https://api-hermes.pathao.com',
      clientId: this.configService.get('PATHAO_CLIENT_ID') || '',
      clientSecret: this.configService.get('PATHAO_CLIENT_SECRET') || '',
      storeId: this.configService.get('PATHAO_STORE_ID') || '',
    };
  }

  /**
   * Authenticate with Pathao API
   */
  async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.accessToken;
    }

    // Need to refresh or get new token
    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Pathao auth failed: ${error}`);
      throw new Error('Failed to authenticate with Pathao');
    }

    const data = await response.json();

    this.token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000, // Buffer of 60 seconds
    };

    return this.token.accessToken;
  }

  /**
   * Get list of cities
   */
  async getCities(): Promise<PathaoResponse<Record<string, unknown>[]>> {
    const token = await this.authenticate();

    const response = await fetch(`${this.config.baseUrl}/api/v1/aladdin/cities`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.json();
  }

  /**
   * Get zones by city ID
   */
  async getZones(cityId: number): Promise<PathaoResponse<Record<string, unknown>[]>> {
    const token = await this.authenticate();

    const response = await fetch(`${this.config.baseUrl}/api/v1/aladdin/zones?city_id=${cityId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.json();
  }

  /**
   * Get area by zone ID
   */
  async getAreas(zoneId: number): Promise<PathaoResponse<Record<string, unknown>[]>> {
    const token = await this.authenticate();

    const response = await fetch(`${this.config.baseUrl}/api/v1/aladdin/areas?zone_id=${zoneId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.json();
  }

  /**
   * Calculate delivery charge
   */
  async calculateDeliveryCharge(
    weight: number,
    cityId: number,
    zoneId: number,
  ): Promise<PathaoResponse<Record<string, unknown>>> {
    const token = await this.authenticate();

    const response = await fetch(`${this.config.baseUrl}/api/v1/aladdin/delivery/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        weight,
        city_id: cityId,
        zone_id: zoneId,
      }),
    });

    return response.json();
  }

  /**
   * Create a consignment/shipment
   */
  async createConsignment(
    orderId: string,
    payload: CreateConsignmentPayload,
  ): Promise<{
    trackingNumber: string;
    consignmentId: string;
    status: string;
  }> {
    const token = await this.authenticate();

    const response = await fetch(`${this.config.baseUrl}/api/v1/aladdin/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        store_id: this.config.storeId,
        merchant_order_id: orderId,
        recipient_name: payload.customerName,
        recipient_phone: payload.customerPhone,
        recipient_address: payload.customerAddress,
        city_id: parseInt(payload.city),
        zone_id: parseInt(payload.zone),
        weight: payload.weight,
        description: payload.description,
        cod_amount: payload.codAmount,
        item_quantity: payload.quantity,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      this.logger.error(`Pathao consignment creation failed: ${JSON.stringify(result)}`);
      throw new Error(result.message || 'Failed to create consignment');
    }

    const consignmentData = result.data[0];

    // Update order with Pathao details
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        courier: 'pathao',
        trackingNumber: consignmentData.tracking_id,
        consignmentId: consignmentData.consignment_id.toString(),
        deliveryStatus: consignmentData.status,
      },
    });

    return {
      trackingNumber: consignmentData.tracking_id,
      consignmentId: consignmentData.consignment_id.toString(),
      status: consignmentData.status,
    };
  }

  /**
   * Track a consignment
   */
  async trackConsignment(trackingNumber: string): Promise<Record<string, unknown>> {
    const token = await this.authenticate();

    const response = await fetch(
      `${this.config.baseUrl}/api/v1/aladdin/orders/${trackingNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to track consignment');
    }

    return result.data[0];
  }

  /**
   * Cancel a consignment
   */
  async cancelConsignment(trackingNumber: string): Promise<void> {
    const token = await this.authenticate();

    const response = await fetch(
      `${this.config.baseUrl}/api/v1/aladdin/orders/${trackingNumber}/cancel`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to cancel consignment');
    }
  }

  /**
   * Auto-create shipment when order is confirmed
   */
  async createShipmentForOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Skip if already has courier
    if (order.courier) {
      this.logger.log(`Order ${order.orderNumber} already has courier: ${order.courier}`);
      return;
    }

    const address = order.shippingAddress as {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      zone?: string;
    };

    if (!address || !address.phone || !address.address) {
      this.logger.warn(`Order ${order.orderNumber} missing shipping address`);
      return;
    }

    // Calculate total weight (estimate 0.5kg per item if not specified)
    const totalWeight = order.items.length * 0.5; // kg

    try {
      const result = await this.createConsignment(orderId, {
        customerName: address.name || order.guestName || 'Customer',
        customerPhone: address.phone,
        customerAddress: address.address,
        city: address.city || '3', // Default to Dhaka if not set
        zone: address.zone || '9', // Default zone if not set
        weight: totalWeight,
        description: `Order #${order.orderNumber} - ${order.items.length} items`,
        codAmount: Number(order.total),
        quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      });

      this.logger.log(
        `Created Pathao consignment for order ${order.orderNumber}: ${result.trackingNumber}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create shipment for order ${order.orderNumber}: ${error}`);
      throw error;
    }
  }
}