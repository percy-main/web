import type { Game } from "@/collections/game";
import { formatDate } from "date-fns";
import { IoChevronForward } from "react-icons/io5";
import { Sponsor } from "./Sponsor";

type Props = {
  id: string;
  game: Game;
};

export const GamePreview = ({ id, game }: Props) => (
  <div className="flex h-full flex-col items-stretch justify-between">
    <div className="flex flex-row justify-start gap-4">
      <img
        src="/images/cricket.png"
        alt="Cricket Match"
        title="Cricket Match"
        width="24"
        height="24"
        loading="eager"
        className="mt-1 self-start"
      />
      <h4 className="text-lg font-semibold">
        {formatDate(game.when, "dd/MM/yyyy")}
      </h4>
    </div>
    <div className="flex flex-row justify-between gap-4">
      <div className="text-xs">
        <p className="mb-4">
          {game.team.name} vs. {game.opposition.club.name}{" "}
          {game.opposition.team.name} {game.home ? "(H)" : "(A)"}
        </p>
        <p>{game.league.name}</p>
        <p>{game.competition.name}</p>
      </div>
      <a
        href={`/calendar/event/${id}`}
        className="flex flex-col items-center justify-center self-stretch"
        aria-label="Read more about this game"
      >
        <IoChevronForward
          className="text-gray-700 hover:text-gray-400"
          fontSize={32}
        />
      </a>
    </div>
    <div className="self-center">
      <Sponsor id={id} game={game} />
    </div>
  </div>
);
