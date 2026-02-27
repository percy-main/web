import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";

type SponsorData = {
  name: string;
  logoUrl?: string;
  message?: string;
  website?: string;
};

type Props = {
  gameId: string;
  ssrSponsor?: SponsorData;
};

const queryClient = new QueryClient();

function GameCardSponsorInner({ gameId, ssrSponsor }: Props) {
  const { data } = useQuery({
    queryKey: ["game-sponsor", gameId],
    queryFn: async () => {
      const result = await actions.sponsorship.getByGameId({ gameId });
      if (result.error) throw result.error;
      return result.data;
    },
    initialData: ssrSponsor
      ? {
          sponsor: {
            name: ssrSponsor.name,
            logoUrl: ssrSponsor.logoUrl,
            message: ssrSponsor.message,
            website: ssrSponsor.website,
          },
        }
      : undefined,
    initialDataUpdatedAt: ssrSponsor ? 0 : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const sponsor = data?.sponsor ?? ssrSponsor;

  if (!sponsor) return null;

  return (
    <div className="mt-auto flex items-center gap-1.5 border-t border-gray-100 pt-2">
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={`Sponsored by ${sponsor.name}`}
          width="60"
          height="24"
          className="h-6 max-w-[60px] object-contain"
        />
      ) : (
        <span className="min-w-0 truncate text-[10px] font-medium leading-tight text-gray-500">
          {sponsor.name}
        </span>
      )}
      <span className="shrink-0 text-[10px] leading-tight text-gray-400">
        Sponsored
      </span>
    </div>
  );
}

export function GameCardSponsor(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <GameCardSponsorInner {...props} />
    </QueryClientProvider>
  );
}
