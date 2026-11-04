import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  CreateSetlistDto,
  ReplaceSetlistSongsDto,
  UpdateSetlistDto,
} from './dto/setlist.dto';
import { SetlistsService } from './setlists.service';

@Controller('setlists')
export class SetlistsController {
  constructor(private readonly setlistsService: SetlistsService) {}

  @Get()
  findAll() {
    return this.setlistsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.setlistsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSetlistDto) {
    return this.setlistsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSetlistDto) {
    return this.setlistsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.setlistsService.remove(id);
  }

  @Put(':id/songs')
  replaceSongs(@Param('id') id: string, @Body() dto: ReplaceSetlistSongsDto) {
    return this.setlistsService.replaceSongs(id, dto);
  }
}
