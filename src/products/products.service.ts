import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import { QueryProductsDto } from './dto/query-products.dto';

const PRODUCT_INCLUDE = {
  subcategory: {
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

interface ProductWriteData {
  name?: string;
  description?: string;
  link?: string;
  subcategoryId?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async findAll(query: QueryProductsDto) {
    const { page, limit, search, categoryId, subcategoryId } = query;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // subcategoryId wins if both are provided.
    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    } else if (categoryId) {
      where.subcategory = { categoryId };
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async create(
    data: {
      name: string;
      description: string;
      link: string;
      subcategoryId: string;
    },
    image?: Express.Multer.File,
  ) {
    await this.ensureSubcategory(data.subcategoryId);

    if (!image) {
      throw new BadRequestException('La imagen del producto es obligatoria');
    }
    const imageUrl = await this.s3.upload(
      image.buffer,
      image.originalname,
      image.mimetype,
    );

    return this.prisma.product.create({
      data: { ...data, imageUrl },
      include: PRODUCT_INCLUDE,
    });
  }

  async update(
    id: string,
    data: ProductWriteData,
    image?: Express.Multer.File,
  ) {
    await this.findOne(id);

    if (data.subcategoryId) {
      await this.ensureSubcategory(data.subcategoryId);
    }

    const updateData: Prisma.ProductUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.link !== undefined) updateData.link = data.link;
    if (data.subcategoryId !== undefined) {
      updateData.subcategory = { connect: { id: data.subcategoryId } };
    }

    if (image) {
      updateData.imageUrl = await this.s3.upload(
        image.buffer,
        image.originalname,
        image.mimetype,
      );
    }

    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: PRODUCT_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  private async ensureSubcategory(subcategoryId: string) {
    const sub = await this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
    });
    if (!sub) {
      throw new BadRequestException('La subcategoría indicada no existe');
    }
    return sub;
  }
}
