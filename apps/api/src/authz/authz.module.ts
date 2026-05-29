import { Global, Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  providers: [AccessControlService, PermissionsGuard],
  exports: [AccessControlService, PermissionsGuard],
})
export class AuthzModule {}
