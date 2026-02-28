import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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
            Found {groups.length} group{groups.length !== 1 ? "s" : ""} of
            potential duplicate member records. Select which record to keep for
            each group.
          </p>

          {groups.map((group) => (
            <DuplicateGroup
              key={`${group.matchType}-${group.members[0]?.id}`}
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
    matchType: string;
    matchKey: string;
    members: Array<{
      id: string;
      name: string;
      email: string;
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
  const isEmailMatch = group.matchType === "email";

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{group.matchKey}</h3>
        <StatusPill variant={isEmailMatch ? "green" : "yellow"}>
          {isEmailMatch ? "Email match" : "Name match"}
        </StatusPill>
        <StatusPill variant="gray">
          {group.members.length} records
        </StatusPill>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keep</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            {!isEmailMatch && <TableHead>Email</TableHead>}
            <TableHead>Stripe</TableHead>
            <TableHead>Memberships</TableHead>
            <TableHead>Dependents</TableHead>
            <TableHead>Charges</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.members.map((member) => (
            <TableRow
              key={member.id}
              className={keepId === member.id ? "bg-green-50" : ""}
            >
              <TableCell>
                <input
                  type="radio"
                  name={`keep-${group.matchType}-${group.matchKey}`}
                  checked={keepId === member.id}
                  onChange={() => setKeepId(member.id)}
                  className="h-4 w-4 text-blue-600"
                />
              </TableCell>
              <TableCell className="font-mono text-xs text-gray-500">
                {member.id.slice(0, 8)}...
              </TableCell>
              <TableCell>{member.name}</TableCell>
              {!isEmailMatch && (
                <TableCell className="text-gray-600">{member.email}</TableCell>
              )}
              <TableCell>
                {member.stripeCustomerId ? (
                  <StatusPill variant="green">Yes</StatusPill>
                ) : (
                  <StatusPill variant="gray">No</StatusPill>
                )}
              </TableCell>
              <TableCell>{member.membershipCount}</TableCell>
              <TableCell>{member.dependentCount}</TableCell>
              <TableCell>{member.chargeCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {keepId && removeMembers.length > 0 && (
        <div className="mt-3 flex gap-2">
          {removeMembers.map((rm) => (
            <Button
              key={rm.id}
              size="sm"
              onClick={() => onPreview(keepId, rm.id)}
            >
              Preview merge (remove {rm.id.slice(0, 8)}...)
            </Button>
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Merge Preview</DialogTitle>
        </DialogHeader>

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

            {preview.isCrossEmailMerge && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Different email addresses</p>
                <p className="mt-1">
                  These members have different email addresses ({preview.keep.member.email} vs{" "}
                  {preview.remove.member.email}). Please verify they are the same person before merging.
                </p>
              </div>
            )}

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
                This action cannot be undone. Type &quot;{preview.isCrossEmailMerge ? "MERGE" : "merge"}&quot; to confirm.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={preview.isCrossEmailMerge ? 'Type "MERGE"' : 'Type "merge"'}
                  className="w-auto"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    confirmText !== (preview.isCrossEmailMerge ? "MERGE" : "merge") || mergeMutation.isPending
                  }
                  onClick={() => mergeMutation.mutate()}
                >
                  {mergeMutation.isPending ? "Merging..." : "Merge Members"}
                </Button>
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
      </DialogContent>
    </Dialog>
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
        <dt className="font-medium text-gray-500">Email</dt>
        <dd>{member.email}</dd>
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
