import { CDN_SPACE_ID, CDN_TOKEN } from "astro:env/server";
import * as contentful from "contentful";

export const client = contentful.createClient({
  space: CDN_SPACE_ID,
  accessToken: CDN_TOKEN,
});
