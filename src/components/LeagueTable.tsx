import type { FC } from "react";
import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";

type Props = {
  name: string;
  divisionId: string;
};

export const LeagueTable: FC<Props> = ({ name, divisionId }) => {
  const query = useQuery({
    queryKey: ["getLeagueTable", "divisionId"],
    queryFn: () => actions.playCricket.getLeagueTable({ divisionId }),
  });

  if (!query.data?.data) {
    return null;
  }

  const { columns, rows } = query.data.data;

  return (
    <div className="container p-2 mx-auto rounded-md sm:p-4 dark:text-gray-800 dark:bg-gray-50">
      <h2 className="mb-3 text-2xl font-semibold leading-tight">{name}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="rounded-t-lg dark:bg-gray-300">
            <tr className="text-right">
              <th title="Position" className="p-3 text-left">
                Position
              </th>
              {columns.map((column) => (
                <th key={column} title={column} className="p-3 text-left">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="text-right border-b border-opacity-20 dark:border-gray-300 dark:bg-gray-100">
                <td className="px-3 py-2 text-left">
                  <span>{row.position}</span>
                </td>
                {columns.map((cell) => (
                  <td className="px-3 py-2 text-left">
                    <span>{row[cell]}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
