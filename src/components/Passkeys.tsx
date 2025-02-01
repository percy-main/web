import { reactClient } from "@/lib/auth/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "date-fns";
import { useState } from "react";
import { IoTrashBinOutline } from "react-icons/io5";
import { SimpleInput } from "./form/SimpleInput";

export const Passkeys = () => {
  const [newPasskeyName, setNewPasskeyName] = useState("");
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
    mutationFn: (name?: string) => reactClient.passkey.addPasskey({ name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      setNewPasskeyName("");
    },
  });

  return (
    <>
      <h2 className="text-h4">Your Passkeys</h2>
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
            <div>
              <p>{passkey.name}</p>
              <p className="text-sm">
                {formatDate(passkey.createdAt, "dd/MM/yyyy HH:MM")}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addPasskey.mutate(newPasskeyName);
        }}
        className="py-4"
      >
        <SimpleInput
          id="name"
          label="Passkey Name"
          value={newPasskeyName}
          onChange={(e) => {
            setNewPasskeyName(e.currentTarget.value);
          }}
          required
          autoComplete="false"
        />
        <button
          type="submit"
          className="text-dark cursor-pointer justify-self-start rounded border-1 border-gray-800 px-4 py-2 text-sm hover:bg-gray-200"
          disabled={!newPasskeyName}
        >
          Add new passkey
        </button>
      </form>
    </>
  );
};
