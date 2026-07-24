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
      // Fetch order details from database
      const order = await this.prisma.order.findUnique({
        where: { id: event.orderId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
          shippingAddress: true,
          user: true,
        },
      });

      if (!order) {
        this.logger.error(`Order not found: ${event.orderId}`);
        return;
      }

      // Build customer data
      const customerData = {
        email: order.user?.email || order.guestEmail || undefined,
        phone: order.user?.phone || order.guestPhone || undefined,
        firstName: order.shippingAddress?.firstName || order.guestName?.split(' ')[0] || undefined,
        lastName: order.shippingAddress?.lastName || order.guestName?.split(' ').slice(1).join(' ') || undefined,
        city: order.shippingAddress?.city || undefined,
        country: order.shippingAddress?.country || 'Bangladesh',
      };

      // Build order items
      const items = order.items.map((item) => ({
        productId: item.variant.product.slug,
        quantity: item.quantity,
      }));

      // Build event source URL
      const eventSourceUrl = `https://denimisia.online/account/orders/${order.orderNumber}`;

      // Send Purchase event to Meta CAPI
      await this.metaService.sendPurchaseEvent(
        order.id,
        order.orderNumber,
        order.total,
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
