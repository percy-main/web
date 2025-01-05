import { renderers } from './renderers.mjs';
import { s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CvSoi7hX.mjs';
import { manifest } from './manifest_poqGxech.mjs';
import { createExports } from '@astrojs/netlify/ssr-function.js';

const serverIslandMap = new Map([
]);;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/news/article/_id_.astro.mjs');
const _page3 = () => import('./pages/news/_page_.astro.mjs');
const _page4 = () => import('./pages/preview/_type_/_entry_.astro.mjs');
const _page5 = () => import('./pages/index.astro.mjs');
const _page6 = () => import('./pages/_---slug_.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/404.astro", _page1],
    ["src/pages/news/article/[id].astro", _page2],
    ["src/pages/news/[page].astro", _page3],
    ["src/pages/preview/[type]/[entry].astro", _page4],
    ["src/pages/index.astro", _page5],
    ["src/pages/[...slug].astro", _page6]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "875a6813-0efe-4ed4-85a8-030047c6e1de"
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (_start in serverEntrypointModule) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
