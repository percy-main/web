import { useContentfulLiveUpdates } from "@contentful/live-preview/react";
import type { FC } from "react";
import { RichText } from "./RichText";

type Props = {
  document: any;
  page: string;
};

export const Preview: FC<Props> = ({ document, page }) => {
  const updated = useContentfulLiveUpdates(document);

  return <RichText document={updated} page={page} />;
};
