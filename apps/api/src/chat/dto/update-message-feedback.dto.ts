import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export const MESSAGE_FEEDBACK_TYPES = ["like", "dislike"] as const;
export type MessageFeedbackType = (typeof MESSAGE_FEEDBACK_TYPES)[number];

export class UpdateMessageFeedbackDto {
  @ApiProperty({ description: "Feedback type", enum: MESSAGE_FEEDBACK_TYPES, required: true })
  @IsIn(MESSAGE_FEEDBACK_TYPES, { message: "feedback type must be like or dislike" })
  type!: MessageFeedbackType;
}
