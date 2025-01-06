import { CDN_SPACE_ID, CDN_TOKEN, CDN_CMA_TOKEN } from "astro:env/server";
import * as contentful from "contentful";
import cm from "contentful-management";

export const contentClient = contentful.createClient({
  space: CDN_SPACE_ID,
  accessToken: CDN_TOKEN,
});
