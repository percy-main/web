import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import { type FormEvent, useState } from "react";
import { StatusPill, getMembershipStatus } from "./StatusPill";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function MemberDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmRole, setConfirmRole] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "userDetail", userId],
    queryFn: () => actions.admin.getUserDetail({ userId }),
  });

  const roleMutation = useMutation({
    mutationFn: (role: "user" | "admin") =>
      actions.admin.setUserRole({ userId, role }),
    onSuccess: () => {
      setConfirmRole(null);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "userDetail", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "listUsers"] });
    },
  });

  const detail = data?.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">User Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {isLoading && <p className="text-gray-500">Loading...</p>}
        {error && (
          <p className="text-red-600">Failed to load user details.</p>
        )}

        {detail && (
          <div className="flex flex-col gap-6">
            {/* User Info */}
            <section>
              <h3 className="mb-2 text-lg font-medium">Account</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-gray-500">Name</dt>
                <dd>{detail.user.name}</dd>
                <dt className="font-medium text-gray-500">Email</dt>
                <dd>{detail.user.email}</dd>
                <dt className="font-medium text-gray-500">Role</dt>
                <dd>
                  <StatusPill
                    variant={
                      detail.user.role === "admin" ? "blue" : "gray"
                    }
                  >
                    {detail.user.role ?? "user"}
                  </StatusPill>
                </dd>
                <dt className="font-medium text-gray-500">Email Verified</dt>
                <dd>{detail.user.emailVerified ? "Yes" : "No"}</dd>
                <dt className="font-medium text-gray-500">Created</dt>
                <dd>{formatDate(detail.user.createdAt, "dd/MM/yyyy HH:mm")}</dd>
              </dl>

              {/* Role management */}
              <div className="mt-3">
                {confirmRole === null ? (
                  <button
                    className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
                    onClick={() =>
                      setConfirmRole(
                        detail.user.role === "admin" ? "user" : "admin",
                      )
                    }
                  >
                    {detail.user.role === "admin"
                      ? "Demote to User"
                      : "Promote to Admin"}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Change role to &quot;{confirmRole}&quot;?
                    </span>
                    <button
                      className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                      disabled={roleMutation.isPending}
                      onClick={() =>
                        roleMutation.mutate(
                          confirmRole as "user" | "admin",
                        )
                      }
                    >
                      {roleMutation.isPending ? "Saving..." : "Confirm"}
                    </button>
                    <button
                      className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
                      onClick={() => setConfirmRole(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {roleMutation.isError && (
                  <p className="mt-1 text-sm text-red-600">
                    Failed to update role.
                  </p>
                )}
              </div>
            </section>

            {/* Member Info */}
            <section>
              <h3 className="mb-2 text-lg font-medium">Member Details</h3>
              {detail.member ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="font-medium text-gray-500">Title</dt>
                  <dd>{detail.member.title}</dd>
                  <dt className="font-medium text-gray-500">Name</dt>
                  <dd>{detail.member.name}</dd>
                  <dt className="font-medium text-gray-500">Address</dt>
                  <dd>{detail.member.address}</dd>
                  <dt className="font-medium text-gray-500">Postcode</dt>
                  <dd>{detail.member.postcode}</dd>
                  <dt className="font-medium text-gray-500">Date of Birth</dt>
                  <dd>{detail.member.dob}</dd>
                  <dt className="font-medium text-gray-500">Telephone</dt>
                  <dd>{detail.member.telephone}</dd>
                  <dt className="font-medium text-gray-500">
                    Emergency Contact
                  </dt>
                  <dd>{detail.member.emergency_contact_name}</dd>
                  <dt className="font-medium text-gray-500">
                    Emergency Phone
                  </dt>
                  <dd>{detail.member.emergency_contact_telephone}</dd>
                </dl>
              ) : (
                <p className="text-sm text-gray-500">
                  No member record found for this user.
                </p>
              )}
            </section>

            {/* Membership Info */}
            <section>
              <h3 className="mb-2 text-lg font-medium">Membership</h3>
              {detail.membership ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="font-medium text-gray-500">Type</dt>
                  <dd>{detail.membership.type ?? "N/A"}</dd>
                  <dt className="font-medium text-gray-500">Paid Until</dt>
                  <dd>
                    {formatDate(
                      detail.membership.paid_until,
                      "dd/MM/yyyy",
                    )}
                  </dd>
                  <dt className="font-medium text-gray-500">Status</dt>
                  <dd>
                    {(() => {
                      const status = getMembershipStatus(
                        detail.membership.paid_until,
                      );
                      return (
                        <StatusPill variant={status.variant}>
                          {status.label}
                        </StatusPill>
                      );
                    })()}
                  </dd>
                  <dt className="font-medium text-gray-500">Created</dt>
                  <dd>
                    {formatDate(
                      detail.membership.created_at,
                      "dd/MM/yyyy",
                    )}
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-gray-500">
                  No membership record found.
                </p>
              )}
            </section>

            {/* Member Charges */}
            {detail.member && (
              <ChargesSection memberId={detail.member.id} />
            )}

            {/* Stripe Charges */}
            <section>
              <h3 className="mb-2 text-lg font-medium">
                Stripe Charge History
              </h3>
              {detail.charges.length === 0 ? (
                <p className="text-sm text-gray-500">No charges found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.charges.map((charge) => (
                        <tr key={charge.id} className="border-b">
                          <td className="px-3 py-2">
                            {formatDate(
                              charge.created,
                              "dd/MM/yyyy HH:mm",
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {currencyFormatter.format(
                              charge.amount / 100,
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {charge.description ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ChargesSection({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const chargesQuery = useQuery({
    queryKey: ["admin", "charges", memberId],
    queryFn: () => actions.admin.getCharges({ memberId }),
  });

  const addChargeMutation = useMutation({
    mutationFn: (data: {
      memberId: string;
      description: string;
      amountPence: number;
      chargeDate: string;
    }) => actions.admin.addCharge(data),
    onSuccess: () => {
      setShowAddForm(false);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "charges", memberId],
      });
    },
  });

  const deleteChargeMutation = useMutation({
    mutationFn: (data: { chargeId: string; reason: string }) =>
      actions.admin.deleteCharge(data),
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteReason("");
      void queryClient.invalidateQueries({
        queryKey: ["admin", "charges", memberId],
      });
    },
  });

  const handleAddCharge = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const description = formData.get("description") as string;
    const amount = formData.get("amount") as string;
    const chargeDate = formData.get("chargeDate") as string;

    const amountPence = Math.round(parseFloat(amount) * 100);

    if (!description || !amount || !chargeDate || isNaN(amountPence) || amountPence <= 0) {
      return;
    }

    addChargeMutation.mutate({
      memberId,
      description,
      amountPence,
      chargeDate,
    });
  };

  const charges = chargesQuery.data?.data;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">Charges</h3>
        <button
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "Add Charge"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddCharge}
          className="mb-4 rounded border border-gray-200 bg-gray-50 p-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="charge-description"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <input
                id="charge-description"
                name="description"
                type="text"
                required
                placeholder="e.g. Match fee"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="charge-amount"
                className="block text-sm font-medium text-gray-700"
              >
                Amount (GBP)
              </label>
              <input
                id="charge-amount"
                name="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="5.00"
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="charge-date"
                className="block text-sm font-medium text-gray-700"
              >
                Date
              </label>
              <input
                id="charge-date"
                name="chargeDate"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={addChargeMutation.isPending}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addChargeMutation.isPending ? "Adding..." : "Add Charge"}
            </button>
          </div>
          {addChargeMutation.isError && (
            <p className="mt-2 text-sm text-red-600">
              Failed to add charge.
            </p>
          )}
        </form>
      )}

      {chargesQuery.isLoading && (
        <p className="text-sm text-gray-500">Loading charges...</p>
      )}

      {chargesQuery.isError && (
        <p className="text-sm text-red-600">Failed to load charges.</p>
      )}

      {charges && charges.length === 0 && (
        <p className="text-sm text-gray-500">No charges found.</p>
      )}

      {charges && charges.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={charge.id} className="border-b">
                  <td className="px-3 py-2">
                    {formatDate(charge.charge_date, "dd/MM/yyyy")}
                  </td>
                  <td className="px-3 py-2">{charge.description}</td>
                  <td className="px-3 py-2">
                    {currencyFormatter.format(charge.amount_pence / 100)}
                  </td>
                  <td className="px-3 py-2">
                    {charge.paid_at ? (
                      <StatusPill variant="green">Paid</StatusPill>
                    ) : charge.payment_confirmed_at ? (
                      <StatusPill variant="blue">Pending</StatusPill>
                    ) : (
                      <StatusPill variant="yellow">Unpaid</StatusPill>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!charge.paid_at && !charge.payment_confirmed_at && (
                      <>
                        {deleteTarget === charge.id ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              placeholder="Reason for deletion"
                              value={deleteReason}
                              onChange={(e) => setDeleteReason(e.target.value)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs"
                            />
                            <div className="flex gap-1">
                              <button
                                className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                                disabled={
                                  deleteChargeMutation.isPending ||
                                  !deleteReason.trim()
                                }
                                onClick={() =>
                                  deleteChargeMutation.mutate({
                                    chargeId: charge.id,
                                    reason: deleteReason,
                                  })
                                }
                              >
                                {deleteChargeMutation.isPending
                                  ? "Deleting..."
                                  : "Confirm"}
                              </button>
                              <button
                                className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100"
                                onClick={() => {
                                  setDeleteTarget(null);
                                  setDeleteReason("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="text-xs text-red-600 hover:text-red-800"
                            onClick={() => setDeleteTarget(charge.id)}
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
