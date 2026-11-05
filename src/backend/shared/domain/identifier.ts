import { ValidationError } from "./errors";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type Id<Brand extends string> = string & { readonly __brand: Brand };

export const Identifier = {
  generate<Brand extends string>(): Id<Brand> {
    return crypto.randomUUID() as Id<Brand>;
  },

  parse<Brand extends string>(raw: string): Id<Brand> {
    if (!UUID_RE.test(raw)) {
      throw new ValidationError("Invalid identifier", { value: raw });
    }
    return raw.toLowerCase() as Id<Brand>;
  },
};
