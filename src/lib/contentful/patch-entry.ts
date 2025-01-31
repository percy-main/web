import { managementClient } from "@/lib/contentful/client";
import { CDN_ENVIRONMENT, CDN_SPACE_ID } from "astro:env/server";
import type { EntryProps, KeyValueMap } from "contentful-management";
import type { OpPatch } from "json-patch";

export const patchEntry = async <TEntry extends KeyValueMap>(
  entryId: string,
  guard: (entry: EntryProps<TEntry>) => boolean,
  patch: OpPatch[],
) => {
  const entry = await managementClient.entry.get<TEntry>({
    entryId,
    spaceId: CDN_SPACE_ID,
    environmentId: CDN_ENVIRONMENT,
  });

  if (!entry) {
    throw new Error(`Missing entry ${entryId}`);
  }

  if (!guard(entry)) {
    throw new Error(`Entry did not match guard criteria`);
  }

  const updated = await managementClient.entry.patch(
    {
      entryId,
      spaceId: CDN_SPACE_ID,
      environmentId: CDN_ENVIRONMENT,
    },
    patch,
    {
      "X-Contentful-Version": entry.sys.version,
    },
  );

  await managementClient.entry.publish(
    {
      entryId,
      spaceId: CDN_SPACE_ID,
      environmentId: CDN_ENVIRONMENT,
    },
    updated,
  );
};
