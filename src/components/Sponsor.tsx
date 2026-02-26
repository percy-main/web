import type { Game } from "@/collections/game";
import { isAfter } from "date-fns";

type Props = {
  id: string;
  game: Game;
};

export const Sponsor = ({ id, game }: Props) => {
  if (game.sponsor) {
    return (
      <div className="flex w-max flex-col items-start gap-2 rounded border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-dark text-center text-sm">
          Sponsored by
          <br />
          <span className="text-lg font-bold">
            {game.sponsor.website ? (
              <a
                href={game.sponsor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {game.sponsor.name}
              </a>
            ) : (
              game.sponsor.name
            )}
          </span>
        </p>
        {game.sponsor.logoUrl && (
          <img
            src={game.sponsor.logoUrl}
            alt={`${game.sponsor.name} logo`}
            className="h-12 max-w-[120px] object-contain"
          />
        )}
        {game.sponsor.message && (
          <p className="text-sm italic text-gray-600">
            &ldquo;{game.sponsor.message}&rdquo;
          </p>
        )}
      </div>
    );
  }

  if (game.when && isAfter(game.when, new Date())) {
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
};
