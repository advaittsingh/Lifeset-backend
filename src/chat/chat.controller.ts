import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Get chat list' })
  async getChatList(@CurrentUser() user: any) {
    return this.chatService.getChatList(user.id);
  }

  @Get(':userId/history')
  @ApiOperation({ summary: 'Get chat history' })
  async getChatHistory(@CurrentUser() user: any, @Param('userId') userId: string) {
    return this.chatService.getChatHistory(user.id, userId);
  }

  @Post('message')
  @ApiOperation({ summary: 'Send message' })
  async sendMessage(
    @CurrentUser() user: any,
    @Body() data: { receiverId: string; message: string; messageType?: string },
  ) {
    return this.chatService.sendMessage(user.id, data.receiverId, data.message, data.messageType);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Send chat invitation' })
  async sendInvitation(@CurrentUser() user: any, @Body() data: { receiverId: string }) {
    return this.chatService.sendInvitation(user.id, data.receiverId);
  }

  @Post('invitations/:id/accept')
  @ApiOperation({ summary: 'Accept invitation' })
  async acceptInvitation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.acceptInvitation(user.id, id);
  }

  @Post('messages/:id/read')
  @ApiOperation({ summary: 'Mark message as read' })
  async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.markAsRead(user.id, id);
  }
}

