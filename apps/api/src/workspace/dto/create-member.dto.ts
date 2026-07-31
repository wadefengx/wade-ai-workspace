import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { WorkspaceRole } from "@prisma/client";

export class CreateMemberDto {
  @ApiProperty({ description: "待添加成员邮箱", example: "bob@wade.local", required: true })
  @IsEmail({}, { message: "邮箱格式不正确" })
  email!: string;

  @ApiProperty({
    description: "新成员工作区角色",
    example: WorkspaceRole.MEMBER,
    required: false,
    enum: WorkspaceRole
  })
  @IsOptional()
  @IsEnum(WorkspaceRole, { message: "角色只能是 MEMBER 或 ADMIN" })
  role?: WorkspaceRole;
}
