import type { z } from "astro:schema";

export const useSearchParam = <T>({
  param,
  decode = true,
  parse,
  schema,
}: {
  param: string;
  decode?: boolean;
  parse?: (params: string) => unknown;
  schema: z.ZodSchema<T>;
}) => {
  const params = new URLSearchParams(window.location.search);

  const rawValue = params.get(param) ?? undefined;

  const value = decode && rawValue ? decodeURIComponent(rawValue) : rawValue;

  const candidate = parse && value ? parse(value) : value;

  return schema.parse(candidate);
};
