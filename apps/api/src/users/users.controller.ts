import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "获取用户列表" })
  @ApiBearerAuth()
  listUsers(@CurrentUser() user: AuthenticatedUser, @Query("q") query?: string) {
    return this.usersService.listUsers(user.id, query);
  }

  @Get("search")
  @ApiOperation({ summary: "搜索用户" })
  @ApiBearerAuth()
  searchUsers(@CurrentUser() user: AuthenticatedUser, @Query("q") query?: string) {
    return this.usersService.listUsers(user.id, query);
  }

  @Patch(":userId")
  @ApiOperation({ summary: "更新用户全局角色" })
  @ApiBearerAuth()
  updateUserRole(
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserRoleDto
  ) {
    return this.usersService.updateUserRole(user.id, userId, dto);
  }

  @Delete(":userId")
  @ApiOperation({ summary: "删除用户" })
  @ApiBearerAuth()
  removeUser(@Param("userId") userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeUser(user.id, userId);
  }
}
