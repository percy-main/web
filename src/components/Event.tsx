import { formatDate } from "date-fns";
import type { Event as TEvent } from "@/collections/event";
import { RichText } from "@/components/RichText";
import { Map } from "@/components/Map";
import type { FC } from "react";

type Props = {
  id: string;
  event: TEvent;
};

export const Event: FC<Props> = ({ id, event }) => (
  <>
    <h2>{event.name}</h2>
    <p className="text-gray-500 text-sm pb-4">
      Published on {formatDate(event.when, "PPPP")}
    </p>

    <RichText page={`news/article/${id}`} document={event.description} />

    {event.location?.coordinates && (
      <Map
        center={event.location.coordinates}
        infoWindow={{
          header: <h4>{event.location.name}</h4>,
          content: (
            <div className="flex flex-col p-4 text-lg sm:text-sm">
              <p>{event.location.street}</p>
              <p>{event.location.city}</p>
              <p>{event.location.county}</p>
              <p>{event.location.country}</p>
              <p>{event.location.postcode}</p>
            </div>
          ),
        }}
      />
    )}
  </>
);
