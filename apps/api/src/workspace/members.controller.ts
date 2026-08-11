import { Body, Controller, Delete, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
import { WorkspaceService } from "./workspace.service";

@ApiTags("members")
@Controller("members")
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Patch(":memberId")
  @ApiOperation({ summary: "Update member role" })
  @ApiBearerAuth()
  updateMemberRole(
    @Param("memberId") memberId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.workspaceService.updateMemberRole(memberId, user.id, dto);
  }

  @Delete(":memberId")
  @ApiOperation({ summary: "Remove workspace member" })
  @ApiBearerAuth()
  removeMember(@Param("memberId") memberId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.removeMember(memberId, user.id);
  }
}
