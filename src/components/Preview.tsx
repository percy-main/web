import type { TypePageSkeleton } from "@/__generated__";
import { useContentfulLiveUpdates } from "@contentful/live-preview/react";
import type { Entry } from "contentful";
import type { FC } from "react";
import type { Game } from "../collections/game";
import { RichText } from "./RichText";

type Props = {
  entry: Entry<TypePageSkeleton, undefined>;
  games: Game[];
};

export const Preview: FC<Props> = ({ entry, games }) => {
  const updated = useContentfulLiveUpdates(entry);

  return (
    <RichText
      document={updated.fields.content}
      page={updated.fields.slug}
      games={games}
    />
  );
};
