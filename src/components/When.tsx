import { formatDate } from "date-fns";
import type { FC } from "react";
import { IoCalendar } from "react-icons/io5";

type Props = {
  start: Date;
  end?: Date;
};
export const When: FC<Props> = ({ start, end }) => (
  <div className="p-4 rounded-xl bg-white flex flex-row gap-4 justify-between items-center">
    <IoCalendar fontSize={32} />
    <div className="flex flex-col gap-4">
      <p>
        <span className="font-semibold">Start: </span>
        {formatDate(start, "dd/MM/yyyy HH:mm")}
      </p>
      {end && (
        <p>
          <span className="font-semibold">Finish: </span>
          {formatDate(end, "dd/MM/yyyy HH:mm")}
        </p>
      )}
    </div>
  </div>
);
