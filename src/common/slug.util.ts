import slugify from 'slugify';

export function toSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, trim: true });
}
