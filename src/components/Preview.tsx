import { useContentfulLiveUpdates } from "@contentful/live-preview/react";
import type { FC } from "react";
import { RichText } from "./RichText";
import type { Entry, EntrySkeletonType } from "contentful";
import type { TypePageSkeleton } from "@/__generated__";

type Props = {
  entry: Entry<TypePageSkeleton, undefined, string>;
};

export const Preview: FC<Props> = ({ entry }) => {
  const updated = useContentfulLiveUpdates(entry);

  return (
    <RichText document={updated.fields.content} page={updated.fields.slug} />
  );
};
