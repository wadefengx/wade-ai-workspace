import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export const MESSAGE_FEEDBACK_TYPES = ["like", "dislike"] as const;
export type MessageFeedbackType = (typeof MESSAGE_FEEDBACK_TYPES)[number];

export class UpdateMessageFeedbackDto {
  @ApiProperty({ description: "反馈类型", enum: MESSAGE_FEEDBACK_TYPES, required: true })
  @IsIn(MESSAGE_FEEDBACK_TYPES, { message: "反馈类型必须是 like 或 dislike" })
  type!: MessageFeedbackType;
}
