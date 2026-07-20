import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PathaoService } from './pathao.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('pathao')
export class PathaoController {
  constructor(private readonly pathaoService: PathaoService) {}

  /**
   * Get list of cities (public for checkout)
   */
  @Get('cities')
  async getCities() {
    return this.pathaoService.getCities();
  }

  /**
   * Get zones by city ID (public for checkout)
   */
  @Get('zones/:cityId')
  async getZones(@Param('cityId') cityId: string) {
    return this.pathaoService.getZones(parseInt(cityId));
  }

  /**
   * Get areas by zone ID (public for checkout)
   */
  @Get('areas/:zoneId')
  async getAreas(@Param('zoneId') zoneId: string) {
    return this.pathaoService.getAreas(parseInt(zoneId));
  }

  /**
   * Calculate delivery charge (public for checkout)
   */
  @Post('delivery-charge')
  async calculateDeliveryCharge(
    @Body() body: { weight: number; cityId: number; zoneId: number },
  ) {
    return this.pathaoService.calculateDeliveryCharge(
      body.weight,
      body.cityId,
      body.zoneId,
    );
  }

  /**
   * Create shipment for an order (admin only)
   */
  @Post('shipments/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  async createShipment(@Param('orderId') orderId: string) {
    return this.pathaoService.createShipmentForOrder(orderId);
  }

  /**
   * Track a consignment (admin and customer)
   */
  @Get('track/:trackingNumber')
  async trackConsignment(@Param('trackingNumber') trackingNumber: string) {
    return this.pathaoService.trackConsignment(trackingNumber);
  }

  /**
   * Cancel a consignment (admin only)
   */
  @Post('cancel/:trackingNumber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)
  async cancelConsignment(@Param('trackingNumber') trackingNumber: string) {
    await this.pathaoService.cancelConsignment(trackingNumber);
    return { success: true, message: 'Consignment cancelled successfully' };
  }
}