import {
  CDN_CMA_TOKEN,
  CDN_ENVIRONMENT,
  CDN_PREVIEW_TOKEN,
  CDN_SPACE_ID,
  CDN_TOKEN,
} from "astro:env/server";
import * as contentful from "contentful";
import cm from "contentful-management";

export const contentClient = contentful.createClient({
  space: CDN_SPACE_ID,
  accessToken: CDN_TOKEN,
  environment: CDN_ENVIRONMENT,
});

export const managementClient = cm.createClient(
  {
    accessToken: CDN_CMA_TOKEN,
  },
  { type: "plain" },
);

export const previewClient = contentful.createClient({
  space: CDN_SPACE_ID,
  accessToken: CDN_PREVIEW_TOKEN,
  environment: CDN_ENVIRONMENT,
  host: "preview.contentful.com",
});
