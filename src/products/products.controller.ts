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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const imageInterceptor = FileInterceptor('image', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
});

const requiredImagePipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
    new FileTypeValidator({ fileType: /^image\// }),
  ],
});

const optionalImagePipe = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES }),
    new FileTypeValidator({ fileType: /^image\// }),
  ],
  fileIsRequired: false,
});

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.products.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(imageInterceptor)
  create(
    @Body() dto: CreateProductDto,
    @UploadedFile(requiredImagePipe) image: Express.Multer.File,
  ) {
    return this.products.create(dto, image);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @UseInterceptors(imageInterceptor)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile(optionalImagePipe) image?: Express.Multer.File,
  ) {
    return this.products.update(id, dto, image);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }
}
