/* empty css                                        */
import { c as createComponent, r as renderTemplate, a as renderComponent, b as createAstro } from '../../../chunks/astro/server_W_e1rFCc.mjs';
import 'kleur/colors';
import { $ as $$Base } from '../../../chunks/Base_BRADwELI.mjs';
import { C as CDN_SPACE_ID, a as CDN_TOKEN } from '../../../chunks/server_CDwYTtOw.mjs';
import * as contentful from 'contentful';
import { R as RichText } from '../../../chunks/RichText_D7v64N9m.mjs';
export { renderers } from '../../../renderers.mjs';

const $$Astro = createAstro();
const prerender = false;
const $$entry = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$entry;
  const client = contentful.createClient({
    space: CDN_SPACE_ID,
    accessToken: CDN_TOKEN
  });
  const { entry } = Astro2.params;
  const response = await client.getEntry(entry);
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": response.fields.title }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "RichText", RichText, { "document": response.fields.content })} ` })}`;
}, "/Users/alexyoung/main2/website/src/pages/preview/[type]/[entry].astro", void 0);

const $$file = "/Users/alexyoung/main2/website/src/pages/preview/[type]/[entry].astro";
const $$url = "/preview/[type]/[entry]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$entry,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
