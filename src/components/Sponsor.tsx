import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { isAfter } from "date-fns";

type SponsorData = {
  name: string;
  logoUrl?: string;
  message?: string;
  website?: string;
};

type Props = {
  id: string;
  when: string | null;
  ssrSponsor?: SponsorData;
};

const queryClient = new QueryClient();

function SponsorInner({ id, when, ssrSponsor }: Props) {
  const { data } = useQuery({
    queryKey: ["game-sponsor", id],
    queryFn: async () => {
      const result = await actions.sponsorship.getByGameId({ gameId: id });
      if (result.error) throw result.error;
      return result.data;
    },
    initialData: ssrSponsor ? { sponsor: ssrSponsor } : undefined,
    initialDataUpdatedAt: ssrSponsor ? 0 : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const sponsor = data?.sponsor ?? ssrSponsor;

  if (sponsor) {
    return (
      <div className="flex w-max flex-col items-start gap-2 rounded border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-dark text-center text-sm">
          Sponsored by
          <br />
          <span className="text-lg font-bold">
            {sponsor.website ? (
              <a
                href={sponsor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {sponsor.name}
              </a>
            ) : (
              sponsor.name
            )}
          </span>
        </p>
        {sponsor.logoUrl && (
          <img
            src={sponsor.logoUrl}
            alt={`${sponsor.name} logo`}
            className="h-12 max-w-[120px] object-contain"
          />
        )}
        {sponsor.message && (
          <p className="text-sm italic text-gray-600">
            &ldquo;{sponsor.message}&rdquo;
          </p>
        )}
      </div>
    );
  }

  if (when && isAfter(new Date(when), new Date())) {
    return (
      <a
        href={`/game/sponsor/${id}`}
        className="mt-4 inline-block justify-self-start rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        Sponsor This Game
      </a>
    );
  }

  return null;
}

export const Sponsor = (props: Props) => (
  <QueryClientProvider client={queryClient}>
    <SponsorInner {...props} />
  </QueryClientProvider>
);
