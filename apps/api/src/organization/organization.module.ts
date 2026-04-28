import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationController } from './organization.controller';
import { OrganizationSummaryController } from './organization-summary.controller';
import { OrganizationService } from './organization.service';
import { UserClubRolesController } from './user-club-roles.controller';
import { UserClubRolesService } from './user-club-roles.service';

@Module({
  imports: [AuthModule],
  controllers: [
    OrganizationController,
    OrganizationSummaryController,
    UserClubRolesController,
  ],
  providers: [OrganizationService, UserClubRolesService],
  exports: [OrganizationService, UserClubRolesService],
})
export class OrganizationModule {}
