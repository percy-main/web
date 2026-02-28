import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth/client";
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
    queryFn: () => authClient.passkey.listUserPasskeys(),
  });

  const deletePasskey = useMutation({
    mutationFn: (id: string) => authClient.passkey.deletePasskey({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
    },
  });

  const addPasskey = useMutation({
    mutationFn: (name?: string) => authClient.passkey.addPasskey({ name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      setNewPasskeyName("");
    },
  });

  return (
    <section>
      <h2 className="text-h4">Your Passkeys</h2>
      <div className="flex flex-col gap-4">
        {query.data?.data?.map((passkey) => (
          <div
            key={passkey.id}
            className="flex max-w-max flex-row items-center justify-start rounded-2xl border border-gray-500 bg-blue-100 p-4"
          >
            <Button
              variant="ghost"
              size="icon"
              className="mr-4"
              onClick={() => {
                deletePasskey.mutate(passkey.id);
              }}
            >
              <IoTrashBinOutline />
            </Button>
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
        <Button
          type="submit"
          variant="outline"
          disabled={!newPasskeyName}
        >
          Add new passkey
        </Button>
      </form>
    </section>
  );
};
