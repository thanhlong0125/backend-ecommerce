import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from '../../../../shared/jwt-auth.guard';
import { UserService } from './user.service';
import { ChangePasswordSchema } from '../../../../../db/userschema/change-password.schema';
import { UpdateUserSchema } from '../../../../../db/userschema/update-user.schema';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  getUser(@Req() request: AuthenticatedRequest) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated user is required');
    }
    return this.userService.getUserProfile(request.user.id);
  }

  @Patch()
  updateUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const result = UpdateUserSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid user update request',
        errors: result.error.flatten().fieldErrors,
      });
    }
    return this.userService.updateUser(request.user.id, result.data);
  }

  @Post('change-password')
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const result = ChangePasswordSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid change-password request',
        errors: result.error.flatten().fieldErrors,
      });
    }
    return this.userService.changePassword(request.user, result.data);
  }
}
