import type { TypePageSkeleton } from "@/__generated__";
import { useContentfulLiveUpdates } from "@contentful/live-preview/react";
import type { Entry } from "contentful";
import type { FC } from "react";
import { RichText } from "./RichText";

type Props = {
  entry: Entry<TypePageSkeleton, undefined, string>;
};

export const Preview: FC<Props> = ({ entry }) => {
  const updated = useContentfulLiveUpdates(entry);

  return (
    <RichText document={updated.fields.content} page={updated.fields.slug} />
  );
};
