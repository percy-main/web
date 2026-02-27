/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { LeaderboardEmbed } from "@/components/LeaderboardEmbed";
import { LeagueTable } from "@/components/LeagueTable";
import {
  documentToReactComponents,
  type Options,
  type RenderNode,
} from "@contentful/rich-text-react-renderer";
import { BLOCKS, INLINES, type Document } from "@contentful/rich-text-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Asset } from "contentful";
import type { FC, ReactNode } from "react";
import type { Game } from "../collections/game";
import { slugup } from "../lib/util/slug";
import { CollectEmail } from "./CollectEmail";
import { ContactForm } from "./ContactForm";
import { EventPreview } from "./EventPreview";
import { GamePreview } from "./GamePreview";
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
        src={fields.file?.url ? `https://${fields.file.url}` : "#"}
        height={fields.file?.details.image?.height}
        width={fields.file?.details.image?.width}
        alt={fields.description}
        className="h-auto max-w-full rounded-lg"
      />
      {metadata.tags.some(
        (tag: { sys: { id: string } }) => tag.sys.id === "nocaption",
      ) ? null : (
        <figcaption className="mt-2 text-sm text-gray-600">
          <h6>{title}</h6>
          {description && <p>{description}</p>}
        </figcaption>
      )}
    </figure>
  );
};

const renderOptions = (page: string, games: Game[]): Options => ({
  renderNode: {
    [INLINES.EMBEDDED_ENTRY]: (node) => {
      const contentTypeId = node.data.target.sys.contentType?.sys.id;
      if (!contentTypeId) return null;
      if (contentTypeId === "trustee") {
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
      } else if (contentTypeId === "league") {
        return (
          <LeagueTable
            divisionId={node.data.target.fields.divisionId}
            name={node.data.target.fields.name}
          />
        );
      } else if (contentTypeId === "cricketLeaderboard") {
        const fields = node.data.target.fields;
        return (
          <LeaderboardEmbed
            title={fields.title}
            season={fields.season ?? undefined}
            discipline={fields.discipline ?? "both"}
            category={fields.category ?? "seniors"}
            limit={fields.limit ?? 10}
          />
        );
      } else if (contentTypeId === "assetLink") {
        return (
          <a
            href={node.data.target.fields.href}
            title={node.data.target.fields.asset.fields.description}
            className="text-blue-600 hover:underline"
          >
            {renderEmbeddedAsset(node.data.target.fields.asset)}
          </a>
        );
      } else if (contentTypeId === "location") {
        return "location";
      } else if (contentTypeId === "event") {
        return (
          <div className="mb-2 h-full max-w-sm rounded-none bg-white p-4 shadow-md lg:rounded-lg">
            <EventPreview
              event={{
                name: node.data.target.fields.name,
                description: node.data.target.fields.description,
                when: node.data.target.fields.when,
                finish: node.data.target.fields.finish,
              }}
              id={node.data.target.sys.id}
            />
          </div>
        );
      } else if (contentTypeId === "gameDetail") {
        const game = games.find(
          (game) => game.id === node.data.target.fields.playCricketId,
        );
        if (!game) {
          return null;
        }
        return (
          <div className="mb-2 h-full max-w-sm rounded-none bg-white p-4 shadow-md lg:rounded-lg">
            <GamePreview game={game} id={game.id} />
          </div>
        );
      } else if (contentTypeId === "emailCollector") {
        return <CollectEmail {...node.data.target.fields} />;
      } else if (contentTypeId === "contactForm") {
        return (
          <ContactForm {...node.data.target.fields} page={page} />
        );
      }
    },
    [BLOCKS.EMBEDDED_ASSET]: (node) => {
      return renderEmbeddedAsset(node.data.target);
    },
    [BLOCKS.UL_LIST]: (node, children) => {
      return (
        <ul className="ml-4 list-disc has-[div.person]:ml-0 has-[div.person]:grid has-[div.person]:w-full has-[div.person]:list-none has-[div.person]:grid-cols-1 has-[div.person]:gap-4 sm:has-[div.person]:grid-cols-2 lg:has-[div.person]:grid-cols-4 [&>li]:mb-6 [&>li>ul]:list-[circle]">
          {children}
        </ul>
      );
    },
    [BLOCKS.OL_LIST]: (node, children) => {
      return <ol className="rich">{children}</ol>;
    },
    [BLOCKS.QUOTE]: (node, children) => {
      return (
        <blockquote className="rounded-lg border-l-4 border-cta bg-white p-6 shadow-sm [&>div:last-child]:mt-2 [&>div:last-child]:text-sm [&>div:last-child]:not-italic">
          {children}
        </blockquote>
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
  document: Document;
  components?: Components<RenderNode>;
  page: string;
  games: Game[];
};

export const RichText: FC<Props> = ({ document, page, games }) => {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <div className="flex flex-col *:mb-4">
        {documentToReactComponents(document, renderOptions(page, games))}
      </div>
    </QueryClientProvider>
  );
};
