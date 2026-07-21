import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface PathaoConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  storeId: string;
  username: string;
  password: string;
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
  type?: string;
  code?: number;
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
    // Use process.env directly to ensure we're getting the values
    // Updated to correct Pathao API base URL (Aladdin API)
    const baseUrl = process.env.PATHAO_BASE_URL || 'https://api.pathao.com';
    const clientId = process.env.PATHAO_CLIENT_ID;
    const clientSecret = process.env.PATHAO_CLIENT_SECRET;
    const storeId = process.env.PATHAO_STORE_ID;
    const username = process.env.PATHAO_USERNAME;
    const password = process.env.PATHAO_PASSWORD;

    this.config = {
      baseUrl,
      clientId: clientId || '',
      clientSecret: clientSecret || '',
      storeId: storeId || '',
      username: username || '',
      password: password || '',
    };

    // Log config on startup
    console.log(`[PATHAO] baseUrl=${baseUrl}, clientId=${clientId ? 'SET' : 'NOT SET'}, storeId=${storeId ? 'SET' : 'NOT SET'}, username=${username ? 'SET' : 'NOT SET'}`);

    if (!this.config.clientId || !this.config.clientSecret || !this.config.storeId || !this.config.username || !this.config.password) {
      this.logger.error('PATHAO CONFIG MISSING: clientId, clientSecret, storeId, username, or password not set in environment');
    } else {
      this.logger.log('Pathao configuration loaded successfully');
    }
  }

  /**
   * Authenticate with Pathao API (Aladdin v1)
   */
  async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.accessToken;
    }

    // Need to refresh or get new token
    const baseUrl = (this.config.baseUrl || '').replace(/\/$/, ''); // Remove trailing slash

    // Updated to use Aladdin API v1 token endpoint
    const tokenUrl = `${baseUrl}/aladdin/api/v1/issue-token`;

    this.logger.log(`Pathao Auth: baseUrl=${baseUrl}, tokenUrl=${tokenUrl}, hasClientId=${!!this.config.clientId}, hasSecret=${!!this.config.clientSecret}, hasUsername=${!!this.config.username}`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'password',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        username: this.config.username,
        password: this.config.password,
      }),
    });

    const responseText = await response.text();
    this.logger.log(`Pathao auth response status: ${response.status}, body: ${responseText.substring(0, 200)}`);

    if (!response.ok) {
      this.logger.error(`Pathao auth failed: ${responseText}`);
      throw new Error(`Failed to authenticate with Pathao: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);

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

    const response = await fetch(`${this.config.baseUrl}/aladdin/api/v1/cities`, {
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

    // Use the correct endpoint: /cities/{cityId}/zone-list
    const response = await fetch(`${this.config.baseUrl}/aladdin/api/v1/cities/${cityId}/zone-list`, {
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

    const response = await fetch(`${this.config.baseUrl}/aladdin/api/v1/areas?zone_id=${zoneId}`, {
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

    const response = await fetch(`${this.config.baseUrl}/aladdin/api/v1/delivery/charge`, {
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

    // Build the order request with correct Pathao API field names
    const orderUrl = `${this.config.baseUrl}/aladdin/api/v1/orders`;
    const cityNum = parseInt(payload.city) || 3; // Default to Dhaka
    const zoneNum = parseInt(payload.zone) || 14; // Default to Dhaka North

    const orderBody = {
      store_id: parseInt(this.config.storeId),
      merchant_order_id: orderId,
      recipient_name: payload.customerName,
      recipient_phone: payload.customerPhone,
      recipient_address: payload.customerAddress,
      recipient_city: cityNum,
      recipient_zone: zoneNum,
      item_weight: payload.weight,
      item_description: payload.description,
      amount_to_collect: payload.codAmount,
      item_quantity: payload.quantity,
      delivery_type: 48, // 48 = Normal delivery
      item_type: 2, // 2 = Parcel (not document)
    };

    this.logger.log(`Creating Pathao order: URL=${orderUrl}, body=${JSON.stringify(orderBody)}`);

    const response = await fetch(orderUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    });

    const responseText = await response.text();
    this.logger.log(`Pathao order response: status=${response.status}, body=${responseText.substring(0, 500)}`);

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      this.logger.error(`Failed to parse Pathao response as JSON: ${responseText.substring(0, 200)}`);
      throw new Error(`Pathao API error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    this.logger.log(`Pathao response: ${JSON.stringify(result)}`);

    // Check for success - Pathao returns either "success": true OR "type": "success"
    const isSuccess = response.ok && (result.success === true || result.type === 'success' || result.code === 200);

    if (!isSuccess) {
      this.logger.error(`Pathao consignment creation failed: ${JSON.stringify(result)}`);
      const errorMsg = String(result.message || (result.errors ? JSON.stringify(result.errors) : 'Failed to create consignment'));
      throw new Error(errorMsg);
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
      `${this.config.baseUrl}/aladdin/api/v1/orders/${trackingNumber}`,
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
      `${this.config.baseUrl}/aladdin/api/v1/orders/${trackingNumber}/cancel`,
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
      line1?: string;
      city?: string;
      state?: string;
      zone?: string;
    };

    // Try multiple sources for phone and address - check all possible fields
    const phone = address?.phone || order.guestPhone;
    const streetAddress = address?.address || address?.street || address?.line1 || 'Address not provided';

    if (!phone || !streetAddress) {
      const missing = !phone ? 'phone' : 'address';
      this.logger.warn(`Order ${order.orderNumber} missing ${missing}`);
      throw new Error(`Cannot create shipment: missing ${missing}. Please update order shipping details.`);
    }

    // Get city from address - default to Dhaka
    let cityId = 1; // Dhaka - default city (Pathao uses 1 for Dhaka)
    let zoneId = 8; // Valid zone for Dhaka (will fetch from API if possible)

    // Try to get city ID from address (could be name like "Dhaka" or number)
    if (address?.city) {
      const cityStr = String(address.city).toLowerCase();
      // Map city names to IDs (Pathao's city IDs)
      if (cityStr.includes('dhaka')) cityId = 1;
      else if (cityStr.includes('chittagong') || cityStr.includes('chattogram')) cityId = 3;
      else if (cityStr.includes('khulna')) cityId = 4;
      else if (cityStr.includes('barisal') || cityStr.includes('barisal')) cityId = 2;
      else if (cityStr.includes('sylhet')) cityId = 6;
      else {
        const parsedCity = parseInt(address.city);
        if (!isNaN(parsedCity)) cityId = parsedCity;
      }
    }

    // Try to get zone from address
    if (address?.zone) {
      const parsedZone = parseInt(address.zone);
      if (!isNaN(parsedZone)) zoneId = parsedZone;
    }

    console.log(`[PATHAO] Starting: cityId=${cityId}, zoneId=${zoneId}, address.city=${address?.city}, address.state=${address?.state}`);

    // Re-authenticate to get fresh token (zones API might need fresh one)
    try {
      await this.authenticate(); // Get fresh token
      console.log(`[PATHAO] Fetching zones for city ${cityId}...`);
      const zonesResponse = await this.getZones(cityId);
      console.log(`[PATHAO] Zones response:`, JSON.stringify(zonesResponse).substring(0, 500));

      // Check for success - Pathao returns either "success": true OR "type": "success"
      const zonesSuccess = zonesResponse.success === true || zonesResponse.type === 'success' || zonesResponse.code === 200;

      // Pathao returns data in nested format: data.data - handle both cases
      const rawData = zonesResponse.data as Record<string, unknown> | undefined;
      const zonesData = rawData && typeof rawData === 'object' && 'data' in rawData
        ? (rawData.data as Array<{ zone_id: number; zone_name: string }>)
        : (rawData as Array<{ zone_id: number; zone_name: string }>);

      if (zonesSuccess && zonesData && Array.isArray(zonesData) && zonesData.length > 0) {
        console.log(`[PATHAO] Valid zones:`, JSON.stringify(zonesData));

        // ALWAYS use first zone from API - guaranteed to be valid
        zoneId = zonesData[0].zone_id;
        console.log(`[PATHAO] Using zone from API: ${zonesData[0].zone_name} (ID: ${zoneId})`);
      } else {
        console.log(`[PATHAO] Using hardcoded zone: ${zoneId}`);
      }
    } catch (e) {
      console.log(`[PATHAO] Zone fetch failed, using hardcoded zone ${zoneId}: ${e}`);
    }

    console.log(`[PATHAO] Final: cityId=${cityId}, zoneId=${zoneId}`);

    // Calculate total weight (estimate 0.5kg per item if not specified)
    const totalWeight = order.items.length * 0.5; // kg

    try {
      // Ensure address is at least 10 characters for Pathao
      let paddedAddress = streetAddress;
      if (paddedAddress && paddedAddress.length < 10) {
        paddedAddress = `${paddedAddress}, Bangladesh`;
      }

      const result = await this.createConsignment(orderId, {
        customerName: address?.name || order.guestName || 'Customer',
        customerPhone: phone,
        customerAddress: paddedAddress,
        city: String(cityId),
        zone: String(zoneId),
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