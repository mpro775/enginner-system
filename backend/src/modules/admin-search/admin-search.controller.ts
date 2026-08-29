import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums";
import { RolesGuard } from "../../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminSearchService } from "./admin-search.service";
import { AdminSearchDto } from "./dto/admin-search.dto";

@Controller("admin-search")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminSearchController {
  constructor(private readonly adminSearchService: AdminSearchService) {}

  @Get()
  async search(@Query() query: AdminSearchDto) {
    return {
      data: await this.adminSearchService.search(query.q, query.limit),
      message: "Admin search completed successfully",
    };
  }
}
