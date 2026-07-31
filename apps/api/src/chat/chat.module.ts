import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { ChannelMemberGuard } from "../common/guards/channel-member.guard";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [ChatController],
  providers: [ChatService, ChannelMemberGuard]
})
export class ChatModule {}
