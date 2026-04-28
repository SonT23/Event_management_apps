import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { AddManagerDto } from './dto/add-manager.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventRegistrationsService } from './event-registrations.service';
import { EventsService } from './events.service';

@SkipThrottle()
@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly registrations: EventRegistrationsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUserPayload,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    return this.events.list(user, { status, page, pageSize });
  }

  @Get('managed')
  async listManagedEvents(@CurrentUser() user: RequestUserPayload) {
    return this.events.listManagedByCurrentUser(user);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.create(dto, user);
  }

  @Get(':id/managers')
  async listManagers(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.listManagers(id, user);
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.getOne(id, user);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.update(id, dto, user);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.remove(id, user);
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.publish(id, user);
  }

  @Post(':id/end')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async end(@Param('id') id: string, @CurrentUser() user: RequestUserPayload) {
    return this.events.end(id, user);
  }

  @Post(':id/managers')
  async addManager(
    @Param('id') id: string,
    @Body() dto: AddManagerDto,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.addManager(id, dto, user);
  }

  @Delete(':id/managers/:userId')
  async removeManager(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.events.removeManager(id, userId, user);
  }

  @Post(':id/registrations')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async register(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.registrations.createRequest(id, user);
  }

  @Get(':id/registrations')
  async listRegistrations(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.registrations.listForEvent(id, user);
  }
}
