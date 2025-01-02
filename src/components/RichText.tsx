import type { FC } from "react";

import {
  documentToReactComponents,
  type Options,
} from "@contentful/rich-text-react-renderer";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";
import { Image } from "astro:assets";

// Create a bespoke renderOptions object to target BLOCKS.EMBEDDED_ENTRY (linked block entries e.g. code blocks)
// INLINES.EMBEDDED_ENTRY (linked inline entries e.g. a reference to another blog post)
// and BLOCKS.EMBEDDED_ASSET (linked assets e.g. images)

const renderOptions: Options = {
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      // target the contentType of the EMBEDDED_ENTRY to display as you need
      if (node.data.target.sys.contentType.sys.id === "trustee") {
        return (
          <div className="trustee max-w-2xl mx-4 sm:max-w-sm md:max-w-sm lg:max-w-sm xl:max-w-sm sm:mx-auto md:mx-auto lg:mx-auto xl:mx-auto mt-16 bg-white shadow-xl rounded-lg text-gray-900">
            <div className="rounded-t-lg h-32 overflow-hidden">
              <img
                className="object-cover object-top w-full"
                src="https://images.unsplash.com/photo-1549880338-65ddcdfd017b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
                alt="Mountain"
              />
            </div>
            <div className="mx-auto w-32 h-32 relative -mt-16 border-4 border-white rounded-full overflow-hidden">
              {node.data.target.fields.photo && (
                <img
                  className="object-cover object-center h-32"
                  src={node.data.target.fields.photo.fields.file.url}
                  alt={node.data.target.fields.photo.fields.file.title}
                />
              )}
            </div>
            <div className="text-center mt-2">
              <h5 className="font-semibold">{node.data.target.fields.name}</h5>
              <p className="text-gray-500">
                {node.data.target.fields.position}
              </p>
            </div>
          </div>
        );
      }
    },
    [BLOCKS.EMBEDDED_ASSET]: (node) => {
      return (
        <img
          src={`https://${node.data.target.fields.file.url}`}
          height={node.data.target.fields.file.details.image.height}
          width={node.data.target.fields.file.details.image.width}
          alt={node.data.target.fields.description}
        />
      );
    },
    [BLOCKS.UL_LIST]: (node, children) => {
      ///has-[div.trustee]:
      return (
        <ul className="w-full flex flex-col lg:flex-row justify-between gap-4">
          {children}
        </ul>
      );
    },
  },
};

type Props = {
  document: any;
};

export const RichText: FC<Props> = ({ document }) => {
  return <>{documentToReactComponents(document, renderOptions)}</>;
};
