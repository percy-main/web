import { SimpleInput } from "@/components/form/SimpleInput";
import { RadioButtons } from "@/components/form/RadioButtons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { differenceInYears, format } from "date-fns";
import { useState, type FC } from "react";

const FIRST_CHILD_PRICE = 50;
const ADDITIONAL_CHILD_PRICE = 30;

type Dependent = {
  name: string;
  sex: string;
  dob: string;
};

const emptyDependent = (): Dependent => ({ name: "", sex: "", dob: "" });

const priceForChild = (existingCount: number, newIndex: number) =>
  existingCount + newIndex === 0 ? FIRST_CHILD_PRICE : ADDITIONAL_CHILD_PRICE;

const calculateTotal = (existingCount: number, newCount: number) => {
  let total = 0;
  for (let i = 0; i < newCount; i++) {
    total += priceForChild(existingCount, i);
  }
  return total;
};

const validateDependent = (dep: Dependent): string | null => {
  if (!dep.name.trim()) return "Name is required.";
  if (!dep.sex) return "Sex is required.";
  if (!dep.dob) return "Date of birth is required.";
  const age = differenceInYears(new Date(), new Date(dep.dob));
  if (age >= 18) return `${dep.name} must be under 18.`;
  if (age < 0) return `Invalid date of birth for ${dep.name}.`;
  return null;
};

const btnPrimary =
  "rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-none";
const btnSecondary =
  "rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-4 focus:ring-blue-300 focus:outline-none";
const btnDanger =
  "rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-300 focus:outline-none";

type Step = "add" | "review" | "done";

const JuniorRegistrationInner: FC = () => {
  const [step, setStep] = useState<Step>("add");
  const [dependents, setDependents] = useState<Dependent[]>([
    emptyDependent(),
  ]);
  const [errors, setErrors] = useState<Array<string | null>>([]);

  const existingDepsQuery = useQuery({
    queryKey: ["dependents"],
    queryFn: actions.dependents,
  });
  const existingCount = existingDepsQuery.data?.data?.currentYearCount ?? 0;

  const addDependentsMutation = useMutation({
    mutationFn: async (deps: Dependent[]) => {
      const result = await actions.addDependents({ dependents: deps });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  const updateDependent = (
    index: number,
    field: keyof Dependent,
    value: string,
  ) => {
    setDependents((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );
    setErrors((prev) => prev.map((e, i) => (i === index ? null : e)));
  };

  const addChild = () => {
    setDependents((prev) => [...prev, emptyDependent()]);
    setErrors((prev) => [...prev, null]);
  };

  const removeChild = (index: number) => {
    if (dependents.length <= 1) return;
    setDependents((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReview = () => {
    const newErrors = dependents.map(validateDependent);
    setErrors(newErrors);
    if (newErrors.some(Boolean)) return;
    setStep("review");
  };

  const handleSubmit = async () => {
    await addDependentsMutation.mutateAsync(dependents);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <h4 className="mb-2">Registration Complete</h4>
          <p className="mb-4 text-sm text-gray-600">
            Your junior members have been registered and a charge has been
            created. Head to the payments tab in the members area to pay.
          </p>
          <a href="/members?tab=payments" className={btnPrimary + " inline-block"}>
            Go to Payments
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h4 className="mb-2">Junior Membership</h4>
      <p className="mb-6 text-sm text-gray-600">
        Register your children as junior members of the club.
      </p>

      {step === "add" && (
        <>
          {dependents.map((dep, i) => (
            <div
              key={i}
              className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <h5 className="text-sm font-semibold">
                  Child {existingCount + i + 1}
                  {` — £${priceForChild(existingCount, i)}`}
                </h5>
                {dependents.length > 1 && (
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => removeChild(i)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <SimpleInput
                id={`dep-name-${i}`}
                label="Full Name"
                required
                value={dep.name}
                onChange={(e) =>
                  updateDependent(i, "name", e.currentTarget.value)
                }
              />
              <RadioButtons
                id={`dep-sex-${i}`}
                value={dep.sex ?? undefined}
                onChange={(val) => updateDependent(i, "sex", val)}
                options={[
                  { title: "Male", value: "male" },
                  { title: "Female", value: "female" },
                ]}
              />
              <SimpleInput
                id={`dep-dob-${i}`}
                label="Date of Birth"
                type="date"
                required
                value={dep.dob}
                onChange={(e) =>
                  updateDependent(i, "dob", e.currentTarget.value)
                }
              />

              {errors[i] && (
                <p className="mt-1 text-sm text-red-600">{errors[i]}</p>
              )}
            </div>
          ))}

          <div className="mb-8 flex flex-wrap gap-3">
            <button type="button" className={btnSecondary} onClick={addChild}>
              + Add Another Child
            </button>
            <button type="button" className={btnPrimary} onClick={handleReview}>
              Review & Pay
            </button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h5 className="mb-4 font-semibold">Summary</h5>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Date of Birth</th>
                  <th className="pb-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {dependents.map((dep, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{dep.name}</td>
                    <td className="py-2">
                      {format(new Date(dep.dob), "dd/MM/yyyy")}
                    </td>
                    <td className="py-2 text-right">
                      £{priceForChild(existingCount, i)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-3" colSpan={2}>
                    Total
                  </td>
                  <td className="pt-3 text-right">
                    £{calculateTotal(existingCount, dependents.length)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mb-4 text-sm text-gray-600">
            This is a one-off payment for junior membership valid until the end
            of {new Date().getFullYear()}. You will not be automatically charged
            when it expires.
          </p>

          {addDependentsMutation.error && (
            <p className="mb-4 text-sm text-red-600">
              {addDependentsMutation.error.message}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setStep("add")}
            >
              Back
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={addDependentsMutation.isPending}
              onClick={handleSubmit}
            >
              {addDependentsMutation.isPending
                ? "Processing..."
                : "Confirm & Pay"}
            </button>
          </div>
        </>
      )}

      <SocialMembershipUpsell />
    </div>
  );
};

const SocialMembershipUpsell: FC = () => {
  const membershipQuery = useQuery({
    queryKey: ["membership"],
    queryFn: actions.membership,
  });

  const membership = membershipQuery.data?.data?.membership;

  if (membership) return null;

  return (
    <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="mb-2 text-sm font-semibold">Support the club?</p>
      <p className="mb-3 text-sm text-gray-600">
        As a parent you don&apos;t need a membership, but if you&apos;d like to
        support the club you can become a social member.
      </p>
      <a
        href="/membership/pay"
        className={btnSecondary + " inline-block text-sm"}
      >
        Become a Social Member
      </a>
    </div>
  );
};

const queryClient = new QueryClient();

export const JuniorRegistration: FC = () => (
  <QueryClientProvider client={queryClient}>
    <JuniorRegistrationInner />
  </QueryClientProvider>
);
