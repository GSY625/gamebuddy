import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './friends.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friends: FriendsService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.friends.listFriends(req.user.id);
  }

  @Get('requests/received')
  received(@Req() req: { user: { id: string } }) {
    return this.friends.listReceivedRequests(req.user.id);
  }

  @Post('requests')
  send(
    @Req() req: { user: { id: string } },
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friends.sendRequest(req.user.id, dto.receiverId);
  }

  @Patch('requests/:id')
  resolve(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body('accept') accept: boolean,
  ) {
    return this.friends.resolveRequest(id, req.user.id, accept);
  }

  @Get('status/:otherId')
  status(
    @Req() req: { user: { id: string } },
    @Param('otherId') otherId: string,
  ) {
    return this.friends.friendshipStatus(req.user.id, otherId);
  }

  @Delete(':friendId')
  remove(
    @Req() req: { user: { id: string } },
    @Param('friendId') friendId: string,
  ) {
    return this.friends.removeFriend(req.user.id, friendId);
  }
}
