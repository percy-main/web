import { jsx, jsxs } from 'react/jsx-runtime';
import { documentToReactComponents } from '@contentful/rich-text-react-renderer';
import { INLINES, BLOCKS } from '@contentful/rich-text-types';

const renderOptions = (page) => ({
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      if (node.data.target.sys.contentType.sys.id === "trustee") {
        const pageDesc = node.data.target.fields.pageData?.[page];
        return /* @__PURE__ */ jsxs("div", { className: "trustee max-w-2xl mx-4 sm:max-w-sm md:max-w-sm lg:max-w-sm xl:max-w-sm sm:mx-auto md:mx-auto lg:mx-auto xl:mx-auto bg-white shadow-xl rounded-lg text-gray-900", children: [
          /* @__PURE__ */ jsx("div", { className: "rounded-t-lg h-32 overflow-hidden", children: /* @__PURE__ */ jsx(
            "img",
            {
              className: "object-cover object-top w-full",
              src: "https://images.unsplash.com/photo-1549880338-65ddcdfd017b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ",
              alt: "Mountain"
            }
          ) }),
          /* @__PURE__ */ jsx("div", { className: "mx-auto w-32 h-32 relative -mt-16 border-4 border-white rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
            "img",
            {
              className: "object-cover object-center h-32",
              src: node.data.target.fields.photo?.fields.file.url ?? "/images/anon.jpg",
              alt: node.data.target.fields.photo?.fields.file.title ?? node.data.target.fields.name
            }
          ) }),
          /* @__PURE__ */ jsxs("div", { className: "text-center mt-2", children: [
            /* @__PURE__ */ jsx("h5", { className: "font-semibold pb-2", children: node.data.target.fields.name }),
            pageDesc && /* @__PURE__ */ jsx("p", { className: "prose", children: pageDesc })
          ] })
        ] });
      }
    },
    [BLOCKS.EMBEDDED_ASSET]: (node) => {
      return /* @__PURE__ */ jsx(
        "img",
        {
          src: `https://${node.data.target.fields.file.url}`,
          height: node.data.target.fields.file.details.image.height,
          width: node.data.target.fields.file.details.image.width,
          alt: node.data.target.fields.description,
          className: "rounded-lg mx-auto"
        }
      );
    },
    [BLOCKS.UL_LIST]: (node, children) => {
      return /* @__PURE__ */ jsx("ul", { className: "has-[div.trustee]:w-full has-[div.trustee]:flex has-[div.trustee]:flex-col has-[div.trustee]:lg:flex-row has-[div.trustee]:justify-around has-[div.trustee]:gap-4", children });
    }
  }
});
const RichText = ({ document, page }) => {
  return /* @__PURE__ */ jsx("div", { className: "[&>*]:mb-4", children: documentToReactComponents(document, renderOptions(page)) });
};

export { RichText as R };
