import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toSlug } from '../common/slug.util';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        subcategories: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, slug: true, categoryId: true },
        },
      },
    });
  }

  async createCategory(name: string, icon?: string | null) {
    const slug = toSlug(name);
    try {
      return await this.prisma.category.create({
        data: { name, slug, icon: icon ?? null },
      });
    } catch (e) {
      throw this.mapKnownError(e, 'Ya existe una categoría con ese nombre');
    }
  }

  async updateCategory(id: string, name?: string, icon?: string | null) {
    await this.ensureCategory(id);
    const data: Prisma.CategoryUpdateInput = {};
    if (name !== undefined) {
      data.name = name;
      data.slug = toSlug(name);
    }
    if (icon !== undefined) {
      data.icon = icon;
    }
    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (e) {
      throw this.mapKnownError(e, 'Ya existe una categoría con ese nombre');
    }
  }

  async deleteCategory(id: string) {
    await this.ensureCategory(id);
    await this.prisma.category.delete({ where: { id } });
  }

  async createSubcategory(categoryId: string, name: string) {
    await this.ensureCategory(categoryId);
    const slug = toSlug(name);
    try {
      return await this.prisma.subcategory.create({
        data: { name, slug, categoryId },
      });
    } catch (e) {
      throw this.mapKnownError(
        e,
        'Ya existe una subcategoría con ese nombre en esta categoría',
      );
    }
  }

  async updateSubcategory(id: string, name?: string) {
    const existing = await this.prisma.subcategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Subcategoría no encontrada');
    }
    const data: Prisma.SubcategoryUpdateInput = {};
    if (name !== undefined) {
      data.name = name;
      data.slug = toSlug(name);
    }
    try {
      return await this.prisma.subcategory.update({ where: { id }, data });
    } catch (e) {
      throw this.mapKnownError(
        e,
        'Ya existe una subcategoría con ese nombre en esta categoría',
      );
    }
  }

  async deleteSubcategory(id: string) {
    const existing = await this.prisma.subcategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Subcategoría no encontrada');
    }
    await this.prisma.subcategory.delete({ where: { id } });
  }

  private async ensureCategory(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return category;
  }

  private mapKnownError(e: unknown, conflictMessage: string): Error {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException(conflictMessage);
    }
    return e as Error;
  }
}
