import { Button } from "@/ui/Button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  AddressLookupInner,
  type AddressValue,
} from "@/components/form/AddressLookup";
import { APIProvider } from "@vis.gl/react-google-maps";
import { MAPS_API_KEY } from "astro:env/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useCallback, useState, type FC } from "react";

type MemberData = {
  title: string | null;
  name: string | null;
  address: string | null;
  postcode: string | null;
  dob: string | null;
  telephone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_telephone: string | null;
};

const emptyMember: MemberData = {
  title: null,
  name: null,
  address: null,
  postcode: null,
  dob: null,
  telephone: null,
  emergency_contact_name: null,
  emergency_contact_telephone: null,
};

export const useMemberDetails = () =>
  useQuery({
    queryKey: ["memberDetails"],
    queryFn: async () => {
      const result = await actions.getMemberDetails();
      if (result.error) throw result.error;
      return result.data;
    },
  });

const fields: Array<{ key: keyof MemberData; label: string }> = [
  { key: "title", label: "Title" },
  { key: "name", label: "Name" },
  { key: "address", label: "Address" },
  { key: "postcode", label: "Postcode" },
  { key: "dob", label: "Date of Birth" },
  { key: "telephone", label: "Telephone" },
  { key: "emergency_contact_name", label: "Emergency Contact" },
  { key: "emergency_contact_telephone", label: "Emergency Phone" },
];

function DisplayView({
  member,
  onEdit,
}: {
  member: MemberData;
  onEdit: () => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h4 mb-0">Your Details</h2>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        {fields.map(({ key, label }) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground font-medium">{label}</dt>
            <dd>{member[key] ?? "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EditView({
  member,
  defaultName,
  onCancel,
  onSaved,
}: {
  member: MemberData | null;
  defaultName?: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const initial = member ?? { ...emptyMember, name: defaultName ?? null };
  const [form, setForm] = useState<MemberData>(initial);

  const update = (field: keyof MemberData, value: string) => {
    setForm({ ...form, [field]: value || null });
  };

  const handleAddressChange = useCallback((value: AddressValue) => {
    setForm((prev) => ({
      ...prev,
      address: value.address,
      postcode: value.postcode,
    }));
  }, []);

  const mutation = useMutation({
    mutationFn: async (data: MemberData) => {
      // Only send non-null fields to the action
      const payload: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== null) {
          payload[key] = value;
        }
      }
      const result = await actions.updateMemberDetails(payload);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["memberDetails"] });
      onSaved();
    },
  });

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <section>
      <h2 className="text-h4">Your Details</h2>
      {!member && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Please complete your details so we can keep in touch and keep you safe
          at the club.
        </div>
      )}
      {mutation.isError && (
        <p className="mb-4 text-sm text-red-600">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Failed to update details. Please try again."}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h3 className="text-h5">About You</h3>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title ?? ""}
              onChange={(e) => update("title", e.currentTarget.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="detail-name">Name</Label>
            <Input
              id="detail-name"
              value={form.name ?? ""}
              onChange={(e) => update("name", e.currentTarget.value)}
            />
          </div>
          <APIProvider apiKey={MAPS_API_KEY}>
            <AddressLookupInner
              onChange={handleAddressChange}
              defaultAddress={member?.address ?? undefined}
              defaultPostcode={member?.postcode ?? undefined}
            />
          </APIProvider>
          <div className="grid gap-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={form.dob ?? ""}
              onChange={(e) => update("dob", e.currentTarget.value)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-h5">Contact</h3>
          <div className="grid gap-2">
            <Label htmlFor="telephone">Telephone</Label>
            <Input
              id="telephone"
              type="tel"
              value={form.telephone ?? ""}
              onChange={(e) => update("telephone", e.currentTarget.value)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-h5">Emergency Contact</h3>
          <p className="text-muted-foreground text-sm">
            We'd like to know some details of an emergency contact so we can
            help ensure you stay safe at the club.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="emergency_contact_name">Contact Name</Label>
            <Input
              id="emergency_contact_name"
              value={form.emergency_contact_name ?? ""}
              onChange={(e) =>
                update("emergency_contact_name", e.currentTarget.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="emergency_contact_telephone">
              Contact Telephone
            </Label>
            <Input
              id="emergency_contact_telephone"
              type="tel"
              value={form.emergency_contact_telephone ?? ""}
              onChange={(e) =>
                update("emergency_contact_telephone", e.currentTarget.value)
              }
            />
          </div>
        </section>

        <div className="flex gap-3">
          <Button
            type="submit"
            variant="outline"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save Details"}
          </Button>
          {member && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

export const MemberDetails: FC = () => {
  const query = useMemberDetails();
  const member = query.data?.member;
  const userName = query.data?.userName;
  const [editing, setEditing] = useState(false);

  if (query.isLoading) return null;

  // No details yet — go straight to edit mode, pre-fill name from session
  if (!member) {
    return (
      <EditView member={null} defaultName={userName ?? null} onCancel={() => undefined} onSaved={() => undefined} />
    );
  }

  if (editing) {
    return (
      <EditView
        member={member}
        defaultName={member.name ? undefined : userName}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return <DisplayView member={member} onEdit={() => setEditing(true)} />;
};
