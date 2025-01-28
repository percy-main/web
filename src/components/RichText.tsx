import { LeagueTable } from "@/components/LeagueTable";
import {
  documentToReactComponents,
  type Options,
  type RenderNode,
} from "@contentful/rich-text-react-renderer";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Asset } from "contentful";
import type { FC, ReactNode } from "react";
import { slugup } from "../lib/util/slug";
import { Person } from "./Person";

const resolvePageData = (
  page: string,
  pageData: Record<string, string> | undefined,
): string | undefined => {
  if (!pageData) {
    return undefined;
  }

  const dataLookup = page.endsWith("/")
    ? page.substring(0, page.length - 1)
    : page;

  const key = `page$${dataLookup}`;
  const data = pageData[key];
  return data;
};

const renderEmbeddedAsset = ({ fields, metadata }: Asset<undefined>) => {
  const title = fields.title;
  const description = fields.description;

  return (
    <figure className="max-w-lg self-center">
      <img
        src={`https://${fields.file?.url}`}
        height={fields.file?.details.image?.height}
        width={fields.file?.details.image?.width}
        alt={fields.description}
        className="h-auto max-w-full rounded-lg"
      />
      {metadata.tags.some(
        (tag: { sys: { id: string } }) => tag.sys.id === "nocaption",
      ) ? null : (
        <figcaption className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          <h6>{title}</h6>
          {description && <p>{description}</p>}
        </figcaption>
      )}
    </figure>
  );
};

const renderOptions = (page: string): Options => ({
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      if (node.data.target.sys.contentType.sys.id === "trustee") {
        return (
          <Person
            person={{
              name: node.data.target.fields.name,
              photo: node.data.target.fields.photo && {
                title: node.data.target.fields.photo.fields.file.title,
                url: node.data.target.fields.photo.fields.file.url,
              },
              slug: node.data.target.fields.slug,
            }}
            pageDescription={resolvePageData(
              page,
              node.data.target.fields.pageData,
            )}
          />
        );
      } else if (node.data.target.sys.contentType.sys.id === "league") {
        return (
          <LeagueTable
            divisionId={node.data.target.fields.divisionId}
            name={node.data.target.fields.name}
          />
        );
      } else if (node.data.target.sys.contentType.sys.id === "assetLink") {
        return (
          <a
            href={node.data.target.fields.href}
            title={node.data.target.fields.asset.fields.description}
            className="text-blue-600 hover:underline"
          >
            {renderEmbeddedAsset(node.data.target.fields.asset)}
          </a>
        );
      } else if (node.data.target.sys.contentType.sys.id === "location") {
        return "location";
      }
    },
    [BLOCKS.EMBEDDED_ASSET]: (node) => {
      return renderEmbeddedAsset(node.data.target);
    },
    [BLOCKS.UL_LIST]: (node, children) => {
      return (
        <ul className="ml-4 list-disc has-[div.person]:ml-0 has-[div.person]:flex has-[div.person]:w-full has-[div.person]:list-none has-[div.person]:flex-col has-[div.person]:flex-wrap has-[div.person]:justify-around has-[div.person]:gap-4 lg:has-[div.person]:flex-row [&>li]:mb-6 [&>li]:basis-1/5 [&>li>ul]:list-[circle]">
          {children}
        </ul>
      );
    },
    [BLOCKS.PARAGRAPH]: (node, children) => {
      return <div>{children}</div>;
    },
    [INLINES.HYPERLINK]: (node, children) => {
      return (
        <a href={node.data.uri} className="text-blue-600 hover:underline">
          {children}
        </a>
      );
    },
    [INLINES.ENTRY_HYPERLINK]: (node, children) => {
      const href = slugup(node.data.target);

      return (
        <a href={`/${href}`} className="text-blue-600 hover:underline">
          {children}
        </a>
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
    <QueryClientProvider client={new QueryClient()}>
      <div className="flex flex-col *:mb-4">
        {documentToReactComponents(document, renderOptions(page))}
      </div>
    </QueryClientProvider>
  );
};
