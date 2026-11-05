import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.service.update(dto);
  }
}
