import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { type FC, useState } from "react";

type Props = {
  contentfulEntryId: string;
  playerSlug: string;
};

const PlayerSponsorInner: FC<Props> = ({ contentfulEntryId, playerSlug }) => {
  const sponsorQuery = useQuery({
    queryKey: ["playerSponsor", contentfulEntryId],
    queryFn: async () => {
      const result = await actions.playerSponsorship.getForPlayer({
        contentfulEntryId,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const pendingQuery = useQuery({
    queryKey: ["playerSponsorPending", contentfulEntryId],
    queryFn: async () => {
      const result = await actions.playerSponsorship.hasPending({
        contentfulEntryId,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !sponsorQuery.data,
  });

  // If there's an approved sponsor, show their details
  if (sponsorQuery.data) {
    const sponsor = sponsorQuery.data;
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="mb-1 text-xs font-semibold tracking-wide text-green-700 uppercase">
          Sponsored by
        </p>
        <p className="text-lg font-bold text-green-900">
          {sponsor.sponsorWebsite ? (
            <a
              href={sponsor.sponsorWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-green-600/30 underline-offset-2 hover:decoration-green-600"
            >
              {sponsor.sponsorName}
            </a>
          ) : (
            sponsor.sponsorName
          )}
        </p>
        {sponsor.sponsorLogoUrl && (
          <img
            src={sponsor.sponsorLogoUrl}
            alt={`${sponsor.sponsorName} logo`}
            className="mt-2 h-12 max-w-[120px] object-contain"
          />
        )}
        {sponsor.sponsorMessage && (
          <p className="mt-2 text-sm italic text-green-800">
            &ldquo;{sponsor.sponsorMessage}&rdquo;
          </p>
        )}
      </div>
    );
  }

  // If there's a pending sponsorship (unpaid or awaiting approval), show nothing
  if (pendingQuery.data?.hasPending) {
    return null;
  }

  // If still loading, show nothing to avoid flash of CTA
  if (sponsorQuery.isLoading || pendingQuery.isLoading) {
    return null;
  }

  // No sponsor and no pending - show CTA
  return (
    <a
      href={`/person/sponsor/${playerSlug}`}
      className="block rounded-lg border border-blue-200 bg-blue-50 p-4 text-center transition hover:border-blue-300 hover:bg-blue-100"
    >
      <p className="text-sm font-semibold text-blue-700">
        Sponsor This Player
      </p>
      <p className="mt-1 text-xs text-blue-600">
        Support this player for the season
      </p>
    </a>
  );
};

export const PlayerSponsor: FC<Props> = (props) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PlayerSponsorInner {...props} />
    </QueryClientProvider>
  );
};
