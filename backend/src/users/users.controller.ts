import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { UserRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { USER_PUBLIC_FIELDS } from '../auth/auth.types';
import { AdminOnly } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class UpdateRoleDto {
  @IsIn(['admin', 'member'])
  role: UserRole;
}

/** Group members. Everyone can see the list; only admins change it. */
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { ...USER_PUBLIC_FIELDS, createdAt: true },
    });
  }

  @AdminOnly()
  @Patch(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    this.assertNotSelf(id, request);
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: USER_PUBLIC_FIELDS,
    });
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    this.assertNotSelf(id, request);
    await this.assertExists(id);
    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  // An admin can't demote or remove themselves, so the group never ends
  // up without an admin.
  private assertNotSelf(id: string, request: AuthenticatedRequest) {
    if (id === request.user.id) {
      throw new BadRequestException('You cannot change your own account');
    }
  }

  private async assertExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
  }
}
