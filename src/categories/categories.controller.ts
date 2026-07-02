import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // --- Categories ---

  @Get('categories')
  findAll() {
    return this.categories.findAll();
  }

  @Post('categories')
  @UseGuards(AdminGuard)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categories.createCategory(dto.name, dto.icon);
  }

  @Patch('categories/:id')
  @UseGuards(AdminGuard)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.updateCategory(id, dto.name, dto.icon);
  }

  @Delete('categories/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id') id: string) {
    return this.categories.deleteCategory(id);
  }

  // --- Subcategories ---

  @Post('categories/:id/subcategories')
  @UseGuards(AdminGuard)
  createSubcategory(
    @Param('id') categoryId: string,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.categories.createSubcategory(categoryId, dto.name);
  }

  @Patch('subcategories/:id')
  @UseGuards(AdminGuard)
  updateSubcategory(
    @Param('id') id: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.categories.updateSubcategory(id, dto.name);
  }

  @Delete('subcategories/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubcategory(@Param('id') id: string) {
    return this.categories.deleteSubcategory(id);
  }
}
