import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { OrganizationService } from './organization.service';

@SkipThrottle()
@Controller('org')
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @Get('departments')
  listDepartments() {
    return this.org.listDepartments();
  }

  @Get('roles')
  listRoles() {
    return this.org.listRoles();
  }
}
