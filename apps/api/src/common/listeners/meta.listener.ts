import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MetaService } from '../../modules/meta/meta.service';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { OrderCreatedEvent } from '../events/order.events';

/**
 * Listener for order-related events to send Meta CAPI events
 */
@Injectable()
export class MetaListener {
  private readonly logger = new Logger(MetaListener.name);

  constructor(
    private readonly metaService: MetaService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Skip if Meta CAPI is not configured
    if (!this.metaService.isConfigured()) {
      return;
    }

    try {
      // Fetch order details from database with proper includes
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        include: {
          items: {
            include: {
              product: { select: { slug: true } },
            },
          },
        },
      });

      if (!order) {
        this.logger.error(`Order not found: ${event.orderId}`);
        return;
      }

      // shippingAddress is stored as JSON, need to cast it
      const shippingAddress = order.shippingAddress as Record<string, unknown> | null;

      // Build customer data from order fields
      // For registered users, we need to fetch user data separately
      let email: string | undefined;
      let phone: string | undefined;
      let firstName: string | undefined;
      let lastName: string | undefined;
      let city: string | undefined;
      let country: string | undefined;

      if (order.userId) {
        // Try to get user data for registered customers
        const user = await this.prisma.user.findUnique({
          where: { id: order.userId },
          select: { email: true, firstName: true, lastName: true, phones: true },
        });
        if (user) {
          email = user.email ?? undefined;
          firstName = user.firstName ?? undefined;
          lastName = user.lastName ?? undefined;
          phone = user.phones?.[0] ?? undefined;
        }
      }

      // Override with guest data if available
      if (order.guestEmail) {
        email = order.guestEmail;
      }
      if (order.guestPhone) {
        phone = order.guestPhone;
      }
      if (order.guestName) {
        const nameParts = order.guestName.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      }

      // Get shipping address data
      if (shippingAddress) {
        city = (shippingAddress.city as string) ?? undefined;
        country = (shippingAddress.country as string) ?? 'Bangladesh';
      }

      const customerData = {
        email,
        phone,
        firstName,
        lastName,
        city,
        country,
      };

      // Build order items from product slugs
      const items = order.items.map((item) => ({
        productId: item.product?.slug ?? 'unknown',
        quantity: item.quantity,
      }));

      // Build event source URL
      const eventSourceUrl = `https://denimisia.online/account/orders/${order.orderNumber}`;

      // Convert total from Decimal to number
      const totalValue = typeof order.total === 'number'
        ? order.total
        : Number(order.total);

      // Send Purchase event to Meta CAPI
      await this.metaService.sendPurchaseEvent(
        order.id,
        order.orderNumber,
        totalValue,
        'BDT',
        items,
        customerData,
        eventSourceUrl,
      );

      this.logger.log(
        `Meta CAPI Purchase event sent for order: ${order.orderNumber} (${order.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send Meta CAPI event for order ${event.orderId}: ${error}`,
      );
    }
  }
}
