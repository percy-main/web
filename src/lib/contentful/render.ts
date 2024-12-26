import { documentToHtmlString } from "@contentful/rich-text-html-renderer";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";

export const render = (document: any) =>
  documentToHtmlString(document, {
    renderNode: {
      [BLOCKS.EMBEDDED_ASSET]: (node, children) => {
        return `<img
            src="https://${node.data.target.fields.file.url}"
            height="${node.data.target.fields.file.details.image.height}"
            width="${node.data.target.fields.file.details.image.width}"
            alt="${node.data.target.fields.description}"
          />`;
      },
    },
  });
