import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";
import { StatusPill } from "./StatusPill";

export function DuplicateMembersTable() {
  const queryClient = useQueryClient();
  const [previewGroup, setPreviewGroup] = useState<{
    keepId: string;
    removeId: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "duplicateMembers"],
    queryFn: () => actions.admin.findDuplicateMembers(),
  });

  const groups = data?.data;

  return (
    <div className="flex flex-col gap-4">
      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load duplicate members.</p>}

      {groups && groups.length === 0 && (
        <div className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          No duplicate member records found.
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-gray-600">
            Found {groups.length} email{groups.length !== 1 ? "s" : ""} with
            duplicate member records. Select which record to keep for each group.
          </p>

          {groups.map((group) => (
            <DuplicateGroup
              key={group.email}
              group={group}
              onPreview={(keepId, removeId) =>
                setPreviewGroup({ keepId, removeId })
              }
            />
          ))}
        </div>
      )}

      {previewGroup && (
        <MergePreviewModal
          keepMemberId={previewGroup.keepId}
          removeMemberId={previewGroup.removeId}
          onClose={() => setPreviewGroup(null)}
          onMerged={() => {
            setPreviewGroup(null);
            void queryClient.invalidateQueries({
              queryKey: ["admin", "duplicateMembers"],
            });
            void queryClient.invalidateQueries({
              queryKey: ["admin", "listUsers"],
            });
          }}
        />
      )}
    </div>
  );
}

function DuplicateGroup({
  group,
  onPreview,
}: {
  group: {
    email: string;
    members: Array<{
      id: string;
      name: string;
      title: string;
      stripeCustomerId: string | null;
      membershipCount: number;
      dependentCount: number;
      chargeCount: number;
    }>;
  };
  onPreview: (keepId: string, removeId: string) => void;
}) {
  const [keepId, setKeepId] = useState<string | null>(null);

  const removeMembers = group.members.filter((m) => m.id !== keepId);

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{group.email}</h3>
        <StatusPill variant="yellow">
          {group.members.length} records
        </StatusPill>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Keep</th>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Stripe</th>
            <th className="px-3 py-2">Memberships</th>
            <th className="px-3 py-2">Dependents</th>
            <th className="px-3 py-2">Charges</th>
          </tr>
        </thead>
        <tbody>
          {group.members.map((member) => (
            <tr
              key={member.id}
              className={`border-b ${keepId === member.id ? "bg-green-50" : ""}`}
            >
              <td className="px-3 py-2">
                <input
                  type="radio"
                  name={`keep-${group.email}`}
                  checked={keepId === member.id}
                  onChange={() => setKeepId(member.id)}
                  className="h-4 w-4 text-blue-600"
                />
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-500">
                {member.id.slice(0, 8)}...
              </td>
              <td className="px-3 py-2">{member.name}</td>
              <td className="px-3 py-2">
                {member.stripeCustomerId ? (
                  <StatusPill variant="green">Yes</StatusPill>
                ) : (
                  <StatusPill variant="gray">No</StatusPill>
                )}
              </td>
              <td className="px-3 py-2">{member.membershipCount}</td>
              <td className="px-3 py-2">{member.dependentCount}</td>
              <td className="px-3 py-2">{member.chargeCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {keepId && removeMembers.length > 0 && (
        <div className="mt-3 flex gap-2">
          {removeMembers.map((rm) => (
            <button
              key={rm.id}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              onClick={() => onPreview(keepId, rm.id)}
            >
              Preview merge (remove {rm.id.slice(0, 8)}...)
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MergePreviewModal({
  keepMemberId,
  removeMemberId,
  onClose,
  onMerged,
}: {
  keepMemberId: string;
  removeMemberId: string;
  onClose: () => void;
  onMerged: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "mergePreview", keepMemberId, removeMemberId],
    queryFn: () =>
      actions.admin.getMergePreview({ keepMemberId, removeMemberId }),
  });

  const mergeMutation = useMutation({
    mutationFn: () =>
      actions.admin.mergeMembers({ keepMemberId, removeMemberId }),
    onSuccess: () => onMerged(),
  });

  const preview = data?.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Merge Preview</h2>
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

        {isLoading && <p className="text-gray-500">Loading preview...</p>}
        {error && (
          <p className="text-red-600">Failed to load merge preview.</p>
        )}

        {preview && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <MemberCard
                label="Keep"
                variant="green"
                member={preview.keep.member}
                memberships={preview.keep.memberships}
                dependents={preview.keep.dependents}
                charges={preview.keep.charges}
              />
              <MemberCard
                label="Remove"
                variant="red"
                member={preview.remove.member}
                memberships={preview.remove.memberships}
                dependents={preview.remove.dependents}
                charges={preview.remove.charges}
              />
            </div>

            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-medium">What will happen:</p>
              <ul className="mt-1 list-inside list-disc">
                {preview.remove.memberships.length > 0 && (
                  <li>
                    {preview.remove.memberships.length} membership(s) will be
                    moved to the kept record
                  </li>
                )}
                {preview.remove.dependents.length > 0 && (
                  <li>
                    {preview.remove.dependents.length} dependent(s) will be
                    moved to the kept record
                  </li>
                )}
                {preview.remove.charges.length > 0 && (
                  <li>
                    {preview.remove.charges.length} charge(s) will be moved to
                    the kept record
                  </li>
                )}
                {!preview.keep.member.stripe_customer_id &&
                  preview.remove.member.stripe_customer_id && (
                    <li>
                      Stripe customer ID will be copied from the removed record
                    </li>
                  )}
                <li>The duplicate member record will be deleted</li>
              </ul>
            </div>

            <div className="rounded border border-red-200 bg-red-50 p-4">
              <p className="mb-2 text-sm font-medium text-red-800">
                This action cannot be undone. Type &quot;merge&quot; to confirm.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type "merge"'
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  disabled={
                    confirmText !== "merge" || mergeMutation.isPending
                  }
                  onClick={() => mergeMutation.mutate()}
                  className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mergeMutation.isPending ? "Merging..." : "Merge Members"}
                </button>
              </div>
              {mergeMutation.isError && (
                <p className="mt-2 text-sm text-red-600">
                  Failed to merge members:{" "}
                  {mergeMutation.error instanceof Error
                    ? mergeMutation.error.message
                    : "Please try again."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberCard({
  label,
  variant,
  member,
  memberships,
  dependents,
  charges,
}: {
  label: string;
  variant: "green" | "red";
  member: {
    id: string;
    name: string;
    title: string;
    email: string;
    address: string;
    postcode: string;
    dob: string;
    telephone: string;
    stripe_customer_id: string | null;
  };
  memberships: Array<{
    id: string;
    type: string | null;
    paid_until: string;
  }>;
  dependents: Array<{
    id: string;
    name: string;
    dob: string;
  }>;
  charges: Array<{
    id: string;
    description: string;
    amount_pence: number;
    paid_at: string | null;
  }>;
}) {
  const borderColor = variant === "green" ? "border-green-300" : "border-red-300";
  const bgColor = variant === "green" ? "bg-green-50" : "bg-red-50";

  return (
    <div className={`rounded border ${borderColor} ${bgColor} p-3`}>
      <div className="mb-2 flex items-center gap-2">
        <StatusPill variant={variant}>{label}</StatusPill>
        <span className="font-mono text-xs text-gray-500">
          {member.id.slice(0, 8)}...
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="font-medium text-gray-500">Name</dt>
        <dd>{member.name}</dd>
        <dt className="font-medium text-gray-500">Title</dt>
        <dd>{member.title}</dd>
        <dt className="font-medium text-gray-500">Address</dt>
        <dd>{member.address}</dd>
        <dt className="font-medium text-gray-500">DOB</dt>
        <dd>{member.dob}</dd>
        <dt className="font-medium text-gray-500">Phone</dt>
        <dd>{member.telephone}</dd>
        <dt className="font-medium text-gray-500">Stripe</dt>
        <dd>{member.stripe_customer_id ?? "None"}</dd>
      </dl>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-gray-200 px-2 py-0.5">
          {memberships.length} membership(s)
        </span>
        <span className="rounded bg-gray-200 px-2 py-0.5">
          {dependents.length} dependent(s)
        </span>
        <span className="rounded bg-gray-200 px-2 py-0.5">
          {charges.length} charge(s)
        </span>
      </div>

      {memberships.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500">Memberships:</p>
          {memberships.map((m) => (
            <p key={m.id} className="text-xs text-gray-600">
              {m.type ?? "adult"} — paid until {m.paid_until}
            </p>
          ))}
        </div>
      )}

      {dependents.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500">Dependents:</p>
          {dependents.map((d) => (
            <p key={d.id} className="text-xs text-gray-600">
              {d.name} (DOB: {d.dob})
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
