import type { FC, ReactNode } from "react";

import {
  documentToReactComponents,
  type Options,
  type RenderNode,
} from "@contentful/rich-text-react-renderer";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";
import { Person } from "./Person";

const renderOptions = (page: string): Options => ({
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      if (node.data.target.sys.contentType.sys.id === "trustee") {
        return (
          <Person
            person={{
              name: node.data.target.fields.name,
              photo: {
                title: node.data.target.fields.photo?.fields.file.title,
                url: node.data.target.fields.photo?.fields.file.url,
              },
              slug: node.data.target.fields.slug,
            }}
            pageDescription={node.data.target.fields.pageData?.[page]}
          />
        );
      } else if (node.data.target.sys.contentType.sys.id === "location") {
        return "location";
      }
    },
    [BLOCKS.EMBEDDED_ASSET]: (node) => {
      return (
        <img
          src={`https://${node.data.target.fields.file.url}`}
          height={node.data.target.fields.file.details.image.height}
          width={node.data.target.fields.file.details.image.width}
          alt={node.data.target.fields.description}
          className="rounded-lg mx-auto"
        />
      );
    },
    [BLOCKS.UL_LIST]: (node, children) => {
      return (
        <ul className="has-[div.person]:w-full has-[div.person]:flex has-[div.person]:flex-col has-[div.person]:lg:flex-row has-[div.person]:justify-around has-[div.person]:gap-4">
          {children}
        </ul>
      );
    },
  },
});

type Components<T> = {
  [K in keyof T]: T[K] extends (a: infer Node, b: ReactNode) => ReactNode
    ?
        | FC<{ node: Node }>
        | { contentType: string; component: FC<{ node: Node }> }
    : never;
};

type Props = {
  document: any;
  components?: Components<RenderNode>;
  page: string;
};

export const RichText: FC<Props> = ({ document, page }) => {
  return (
    <div className="[&>*]:mb-4">
      {documentToReactComponents(document, renderOptions(page))}
    </div>
  );
};
