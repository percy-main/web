import type { Game } from "@/collections/game";
import { PaymentLink } from "@/components/PaymentLink";
import { paymentData } from "@/lib/payments/config";
import { isAfter } from "date-fns";

type Props = {
  id: string;
  game: Game;
};

export const Sponsor = ({ id, game }: Props) => {
  return game.sponsor ? (
    <div className="flex w-max flex-col items-start">
      <p className="text-dark mt-2 px-4 py-2 text-center text-sm">
        Sponsored by
        <br />
        <span className="text-lg font-bold">{game.sponsor.name}</span>
      </p>
    </div>
  ) : isAfter(game.when, new Date()) ? (
    <div className="mt-4 justify-self-start rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-700">
      <PaymentLink
        priceId={paymentData.prices.sponsorship}
        metadata={{ type: "sponsorGame", gameId: id }}
      >
        Sponsor This Game
      </PaymentLink>
    </div>
  ) : null;
};
