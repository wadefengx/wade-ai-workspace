import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("search")
  @ApiOperation({ summary: "搜索用户" })
  @ApiBearerAuth()
  searchUsers(@Query("q") query?: string) {
    return this.usersService.searchUsers(query);
  }
}
