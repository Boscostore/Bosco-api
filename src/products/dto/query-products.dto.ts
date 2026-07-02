import { IsInt, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryProductsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Transform(({ value }) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Transform(({ value }) => {
    const allowed = [10, 50, 100];
    const n = Number(value);
    return allowed.includes(n) ? n : 10;
  })
  limit = 10;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  subcategoryId?: string;
}
