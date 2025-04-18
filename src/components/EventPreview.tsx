import type { Event } from "@/collections/event";
import { formatDate } from "date-fns";
import type { FC } from "react";
import { IoCalendar, IoChevronForward } from "react-icons/io5";

type Props = {
  id: string;
  event: Omit<Event, "createdAt">;
};

export const EventPreview: FC<Props> = ({ id, event }) => (
  <>
    <div className="flex flex-col items-stretch justify-between">
      <div className="flex flex-row gap-4">
        <IoCalendar title="Event" fontSize={32} />
        <h4 className="text-lg font-semibold">
          {formatDate(event.when, "dd/MM/yyyy")}
        </h4>
      </div>
      <div className="mt-4 flex flex-row items-center justify-between gap-4">
        <p className="text-sm">{event.name}</p>

        <a
          href={`/calendar/event/${id}`}
          className="flex flex-col items-center justify-center self-stretch"
        >
          <IoChevronForward
            className="text-gray-700 hover:text-gray-400"
            fontSize={32}
            aria-label="Read more about this event"
          />
        </a>
      </div>
    </div>

    <div>
      <div className="w-full"></div>
    </div>
  </>
);
