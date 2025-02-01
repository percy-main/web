import { reactClient } from "@/lib/auth/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "date-fns";
import { IoTrashBinOutline } from "react-icons/io5";

export const Passkeys = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => reactClient.passkey.listUserPasskeys(),
  });

  const deletePasskey = useMutation({
    mutationFn: (id: string) => reactClient.passkey.deletePasskey({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
    },
  });

  const addPasskey = useMutation({
    mutationFn: () => reactClient.passkey.addPasskey(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
    },
  });

  return (
    <>
      <h2 className="text-h4 mb-0">Your Passkeys</h2>
      <div className="flex flex-col gap-4">
        {query.data?.data?.map((passkey) => (
          <div
            key={passkey.id}
            className="flex flex-row items-center justify-start rounded-2xl border border-gray-500 bg-blue-100 p-4"
          >
            <button
              className="mr-4"
              onClick={() => {
                deletePasskey.mutate(passkey.id);
              }}
            >
              <IoTrashBinOutline />
            </button>
            Created {formatDate(passkey.createdAt, "dd/MM/yyyy HH:MM")}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          addPasskey.mutate();
        }}
        className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
      >
        Add new passkey
      </button>
    </>
  );
};
