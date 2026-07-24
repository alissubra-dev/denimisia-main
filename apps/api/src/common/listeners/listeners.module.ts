import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../modules/audit-log/audit-log.module';
import { EmailModule } from '../../modules/email/email.module';
import { MetaModule } from '../../modules/meta/meta.module';
import { OrderListener } from './order.listener';
import { OrderEmailListener } from './order-email.listener';
import { ReturnEmailListener } from './return-email.listener';
import { InventoryListener } from './inventory.listener';
import { MetaListener } from './meta.listener';

@Module({
  imports: [AuditLogModule, EmailModule, MetaModule],
  providers: [
    OrderListener,
    OrderEmailListener,
    ReturnEmailListener,
    InventoryListener,
    MetaListener,
  ],
})
export class ListenersModule {}
