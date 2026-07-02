import { IsString, IsNotEmpty, IsUrl, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trim)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  description: string;

  @IsUrl({ require_protocol: true }, { message: 'link debe ser una URL válida' })
  @Transform(trim)
  link: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  subcategoryId: string;
}
