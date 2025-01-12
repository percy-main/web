import { z } from "astro/zod";

export const coordinates = z.object({
  lat: z.number(),
  lon: z.number(),
});

export type Coordinates = z.TypeOf<typeof coordinates>;

export const schema = z.object({
  name: z.string(),
  street: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  country: z.string().optional(),
  postcode: z.string().optional(),
  coordinates: coordinates.optional(),
});
