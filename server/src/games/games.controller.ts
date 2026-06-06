import { Controller, Get, Param } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private games: GamesService) {}

  @Get()
  list() {
    return this.games.list();
  }

  @Get(':id/schema')
  schema(@Param('id') id: string) {
    return this.games.getSchema(id);
  }
}
