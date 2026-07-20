import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface PathaoConfig {
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

export interface CreateConsignmentPayload {
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

export interface PathaoResponse<T> {
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
    this.logger.log(`Authenticating with Pathao. BaseUrl: ${this.config.baseUrl}, ClientId: ${this.config.clientId ? 'set' : 'NOT SET'}, StoreId: ${this.config.storeId || 'NOT SET'}`);

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
      this.logger.error(`Pathao auth failed with status ${response.status}: ${error}`);
      throw new Error(`Failed to authenticate with Pathao: ${error}`);
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

    this.logger.log(`Pathao response: ${JSON.stringify(result)}`);

    if (!response.ok || !result.success) {
      this.logger.error(`Pathao consignment creation failed: ${JSON.stringify(result)}`);
      throw new Error(result.message || result.errors || 'Failed to create consignment');
    }

    // Pathao returns data as array, try different paths
    const consignmentData = result.data?.[0] ?? result.data ?? result;
    this.logger.log(`Consignment data: ${JSON.stringify(consignmentData)}`);

    // Extract tracking info - handle different field names
    const trackingNumber = consignmentData.tracking_id ?? consignmentData.trackingId ?? consignmentData.order_id ?? 'N/A';
    const consignmentId = consignmentData.consignment_id ?? consignmentData.consignmentId ?? consignmentData.id ?? 'N/A';
    const status = consignmentData.status ?? consignmentData.delivery_status ?? 'Pending';

    // Update order with Pathao details
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        courier: 'pathao',
        trackingNumber: String(trackingNumber),
        consignmentId: String(consignmentId),
        deliveryStatus: status,
      },
    });

    return {
      trackingNumber: String(trackingNumber),
      consignmentId: String(consignmentId),
      status,
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
      street?: string;
      city?: string;
      zone?: string;
    };

    // Try multiple sources for phone and address
    const phone = address?.phone || order.guestPhone;
    const streetAddress = address?.address || address?.street || 'Address not provided';

    if (!phone || !streetAddress) {
      const missing = !phone ? 'phone' : 'address';
      this.logger.warn(`Order ${order.orderNumber} missing ${missing}`);
      throw new Error(`Cannot create shipment: missing ${missing}. Please update order shipping details.`);
    }

    // Calculate total weight (estimate 0.5kg per item if not specified)
    const totalWeight = order.items.length * 0.5; // kg

    try {
      const result = await this.createConsignment(orderId, {
        customerName: address?.name || order.guestName || 'Customer',
        customerPhone: phone,
        customerAddress: streetAddress,
        city: address?.city || '3', // Default to Dhaka if not set
        zone: address?.zone || '9', // Default zone if not set
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