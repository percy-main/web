import { SimpleInput } from "@/components/form/SimpleInput";
import { RadioButtons } from "@/components/form/RadioButtons";
import { Button, buttonVariants } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { differenceInYears, format } from "date-fns";
import { useState, type FC } from "react";

const FIRST_CHILD_PRICE = 50;
const ADDITIONAL_CHILD_PRICE = 30;

const SCHOOL_YEARS = [
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
  "Year 13",
];

const PREVIOUS_CRICKET_OPTIONS = [
  "First/Primary School",
  "Middle/Secondary School",
  "SEN School",
  "Local Authority Coaching Session",
  "Club",
  "County",
];

const DISABILITY_TYPES = [
  "Visual Impairment",
  "Hearing Impairment",
  "Physical Disability",
  "Learning Disability",
  "Multiple Disability",
];

type Dependent = {
  name: string;
  sex: string;
  dob: string;
  school_year: string;
  played_before: boolean | null;
  previous_cricket: string;
  whatsapp_consent: boolean | null;
  alt_contact_name: string;
  alt_contact_phone: string;
  alt_contact_whatsapp_consent: boolean | null;
  gp_surgery: string;
  gp_phone: string;
  has_disability: boolean | null;
  disability_type: string;
  medical_info: string;
  emergency_medical_consent: boolean | null;
  medical_fitness_declaration: boolean | null;
  data_protection_consent: boolean | null;
  photo_consent: boolean | null;
};

const emptyDependent = (): Dependent => ({
  name: "",
  sex: "",
  dob: "",
  school_year: "",
  played_before: null,
  previous_cricket: "",
  whatsapp_consent: null,
  alt_contact_name: "",
  alt_contact_phone: "",
  alt_contact_whatsapp_consent: null,
  gp_surgery: "",
  gp_phone: "",
  has_disability: null,
  disability_type: "",
  medical_info: "",
  emergency_medical_consent: null,
  medical_fitness_declaration: null,
  data_protection_consent: null,
  photo_consent: null,
});

const priceForChild = (existingCount: number, newIndex: number) =>
  existingCount + newIndex === 0 ? FIRST_CHILD_PRICE : ADDITIONAL_CHILD_PRICE;

const calculateTotal = (existingCount: number, newCount: number) => {
  let total = 0;
  for (let i = 0; i < newCount; i++) {
    total += priceForChild(existingCount, i);
  }
  return total;
};

type Step = "children" | "cricket" | "contact" | "medical" | "consents" | "review" | "done";

const STEPS: Step[] = ["children", "cricket", "contact", "medical", "consents", "review"];

const STEP_LABELS: Record<Step, string> = {
  children: "Children",
  cricket: "Cricket",
  contact: "Contact",
  medical: "Medical",
  consents: "Consents",
  review: "Review",
  done: "Done",
};

const validateChildrenStep = (deps: Dependent[]): string[] => {
  return deps.map((dep) => {
    if (!dep.name.trim()) return "Name is required.";
    if (!dep.sex) return "Gender is required.";
    if (!dep.dob) return "Date of birth is required.";
    if (!dep.school_year) return "School year is required.";
    const age = differenceInYears(new Date(), new Date(dep.dob));
    if (age >= 18) return `${dep.name} must be under 18.`;
    if (age < 0) return `Invalid date of birth for ${dep.name}.`;
    return "";
  });
};

const validateCricketStep = (deps: Dependent[]): string[] => {
  return deps.map((dep) => {
    if (dep.played_before === null) return "Please indicate if your child has played cricket before.";
    return "";
  });
};

const validateContactStep = (deps: Dependent[]): string[] => {
  return deps.map((dep) => {
    if (dep.whatsapp_consent === null)
      return "WhatsApp consent is required.";
    if (!dep.alt_contact_name.trim())
      return "Alternative contact name is required.";
    if (!dep.alt_contact_phone.trim())
      return "Alternative contact phone number is required.";
    if (dep.alt_contact_whatsapp_consent === null)
      return "Alternative contact WhatsApp consent is required.";
    return "";
  });
};

const validateMedicalStep = (deps: Dependent[]): string[] => {
  return deps.map((dep) => {
    if (!dep.gp_surgery.trim()) return "GP surgery name is required.";
    if (!dep.gp_phone.trim()) return "GP phone number is required.";
    if (dep.has_disability === null)
      return "Please indicate whether your child has a disability.";
    if (dep.emergency_medical_consent === null)
      return "Emergency medical consent is required.";
    if (!dep.emergency_medical_consent)
      return "You must consent to emergency medical treatment to register.";
    if (dep.medical_fitness_declaration === null)
      return "Medical fitness declaration is required.";
    if (!dep.medical_fitness_declaration)
      return "You must confirm the medical fitness declaration to register.";
    return "";
  });
};

const validateConsentsStep = (deps: Dependent[]): string[] => {
  return deps.map((dep) => {
    if (dep.data_protection_consent === null)
      return "Data protection consent is required.";
    if (!dep.data_protection_consent)
      return "You must consent to data processing to register.";
    if (dep.photo_consent === null)
      return "Photo consent is required.";
    return "";
  });
};


const StepIndicator: FC<{ currentStep: Step }> = ({ currentStep }) => {
  const currentIndex = STEPS.indexOf(currentStep);
  return (
    <nav className="mb-6">
      <ol className="flex items-center text-xs font-medium text-gray-500 sm:text-sm">
        {STEPS.map((step, i) => {
          const isActive = i === currentIndex;
          const isComplete = i < currentIndex;
          return (
            <li
              key={step}
              className={`flex items-center ${i < STEPS.length - 1 ? "after:mx-2 after:inline-block after:h-px after:w-4 after:bg-gray-300 after:content-[''] sm:after:w-8" : ""}`}
            >
              <span
                className={`flex items-center gap-1 whitespace-nowrap ${isActive ? "font-semibold text-blue-700" : ""} ${isComplete ? "text-green-600" : ""}`}
              >
                {isComplete && (
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
                <span className="sm:hidden">{i + 1}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

const SelectInput: FC<{
  id: string;
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ id, label, value, options, onChange }) => (
  <div className="mt-2 mb-5 w-full space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={`Select ${label}`} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const TextAreaInput: FC<{
  id: string;
  label: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}> = ({ id, label, value, required, placeholder, onChange }) => (
  <div className="mt-2 mb-5 w-full space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Textarea
      id={id}
      name={id}
      value={value}
      required={required}
      placeholder={placeholder}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const JuniorRegistrationInner: FC = () => {
  const [step, setStep] = useState<Step>("children");
  const [dependents, setDependents] = useState<Dependent[]>([
    emptyDependent(),
  ]);
  const [errors, setErrors] = useState<string[]>([]);

  const existingDepsQuery = useQuery({
    queryKey: ["dependents"],
    queryFn: actions.dependents,
  });
  const existingCount = existingDepsQuery.data?.data?.currentYearCount ?? 0;

  const addDependentsMutation = useMutation({
    mutationFn: async (deps: Dependent[]) => {
      const result = await actions.addDependents({
        dependents: deps.map((d) => ({
          ...d,
          played_before: d.played_before ?? false,
          whatsapp_consent: d.whatsapp_consent ?? false,
          alt_contact_whatsapp_consent:
            d.alt_contact_whatsapp_consent ?? false,
          has_disability: d.has_disability ?? false,
          emergency_medical_consent: d.emergency_medical_consent ?? false,
          medical_fitness_declaration:
            d.medical_fitness_declaration ?? false,
          data_protection_consent: d.data_protection_consent ?? false,
          photo_consent: d.photo_consent ?? false,
          previous_cricket: d.previous_cricket || undefined,
          disability_type: d.disability_type || undefined,
          medical_info: d.medical_info || undefined,
        })),
      });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  const updateDependent = (
    index: number,
    updates: Partial<Dependent>,
  ) => {
    setDependents((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...updates } : d)),
    );
    setErrors((prev) => prev.map((e, i) => (i === index ? "" : e)));
  };

  const addChild = () => {
    setDependents((prev) => [...prev, emptyDependent()]);
    setErrors((prev) => [...prev, ""]);
  };

  const removeChild = (index: number) => {
    if (dependents.length <= 1) return;
    setDependents((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const validateAndAdvance = (nextStep: Step) => {
    let newErrors: string[] = [];

    switch (step) {
      case "children":
        newErrors = validateChildrenStep(dependents);
        break;
      case "cricket":
        newErrors = validateCricketStep(dependents);
        break;
      case "contact":
        newErrors = validateContactStep(dependents);
        break;
      case "medical":
        newErrors = validateMedicalStep(dependents);
        break;
      case "consents":
        newErrors = validateConsentsStep(dependents);
        break;
    }

    setErrors(newErrors);
    if (newErrors.some((e) => e !== "")) return;
    setStep(nextStep);
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
          <a href="/members?tab=payments" className={buttonVariants()}>
            Go to Payments
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h4 className="mb-2">Junior Membership Registration</h4>
      <p className="mb-4 text-sm text-gray-600">
        Register your children as junior members of Percy Main Cricket Club.
      </p>

      <StepIndicator currentStep={step} />

      {/* Step 1: Children basic info */}
      {step === "children" && (
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
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeChild(i)}
                  >
                    Remove
                  </Button>
                )}
              </div>

              <SimpleInput
                id={`dep-name-${i}`}
                label="Child's Full Name"
                required
                value={dep.name}
                onChange={(e) =>
                  updateDependent(i, { name: e.currentTarget.value })
                }
              />
              <RadioButtons
                id={`dep-sex-${i}`}
                value={dep.sex || undefined}
                onChange={(val) => updateDependent(i, { sex: val })}
                options={[
                  { title: "Male", value: "male" },
                  { title: "Female", value: "female" },
                  { title: "Prefer not to say", value: "prefer_not_to_say" },
                ]}
              />
              <SimpleInput
                id={`dep-dob-${i}`}
                label="Date of Birth"
                type="date"
                required
                value={dep.dob}
                onChange={(e) =>
                  updateDependent(i, { dob: e.currentTarget.value })
                }
              />
              <SelectInput
                id={`dep-school-year-${i}`}
                label="School Year"
                value={dep.school_year}
                options={SCHOOL_YEARS}
                required
                onChange={(val) => updateDependent(i, { school_year: val })}
              />

              {errors[i] && (
                <p className="mt-1 text-sm text-red-600">{errors[i]}</p>
              )}
            </div>
          ))}

          <div className="mb-8 flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={addChild}>
              + Add Another Child
            </Button>
            <Button
              type="button"
              onClick={() => validateAndAdvance("cricket")}
            >
              Next: Cricket Experience
            </Button>
          </div>
        </>
      )}

      {/* Step 2: Cricket experience */}
      {step === "cricket" && (
        <>
          {dependents.map((dep, i) => (
            <div
              key={i}
              className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h5 className="mb-3 text-sm font-semibold">{dep.name}</h5>

              <p className="mb-2 text-sm font-medium text-gray-700">
                Has your child played cricket before?
              </p>
              <RadioButtons
                id={`dep-played-before-${i}`}
                value={
                  dep.played_before === null
                    ? undefined
                    : dep.played_before
                      ? "yes"
                      : "no"
                }
                onChange={(val) =>
                  updateDependent(i, {
                    played_before: val === "yes",
                    previous_cricket: val === "no" ? "" : dep.previous_cricket,
                  })
                }
                options={[
                  { title: "Yes", value: "yes" },
                  { title: "No", value: "no" },
                ]}
              />

              {dep.played_before && (
                <>
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Where have they played cricket?
                  </p>
                  <RadioButtons
                    id={`dep-previous-cricket-${i}`}
                    value={dep.previous_cricket || undefined}
                    onChange={(val) =>
                      updateDependent(i, { previous_cricket: val })
                    }
                    options={PREVIOUS_CRICKET_OPTIONS.map((opt) => ({
                      title: opt,
                      value: opt,
                    }))}
                  />
                </>
              )}

              {errors[i] && (
                <p className="mt-1 text-sm text-red-600">{errors[i]}</p>
              )}
            </div>
          ))}

          <StepNav
            onBack={() => setStep("children")}
            onNext={() => validateAndAdvance("contact")}
            nextLabel="Next: Contact Details"
          />
        </>
      )}

      {/* Step 3: Contact details */}
      {step === "contact" && (
        <>
          {dependents.map((dep, i) => (
            <div
              key={i}
              className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h5 className="mb-3 text-sm font-semibold">{dep.name}</h5>

              <p className="mb-2 text-sm font-medium text-gray-700">
                Do you give permission for your mobile phone number to be added
                to this child&apos;s team WhatsApp groups?
              </p>
              <RadioButtons
                id={`dep-whatsapp-${i}`}
                value={
                  dep.whatsapp_consent === null
                    ? undefined
                    : dep.whatsapp_consent
                      ? "yes"
                      : "no"
                }
                onChange={(val) =>
                  updateDependent(i, { whatsapp_consent: val === "yes" })
                }
                options={[
                  { title: "Yes", value: "yes" },
                  { title: "No", value: "no" },
                ]}
              />

              <h6 className="mb-2 mt-4 text-sm font-semibold text-gray-700">
                Alternative Contact
              </h6>
              {i > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mb-3"
                  onClick={() =>
                    updateDependent(i, {
                      alt_contact_name: dependents[0].alt_contact_name,
                      alt_contact_phone: dependents[0].alt_contact_phone,
                      alt_contact_whatsapp_consent:
                        dependents[0].alt_contact_whatsapp_consent,
                    })
                  }
                >
                  Copy from {dependents[0].name || "Child 1"}
                </Button>
              )}
              <SimpleInput
                id={`dep-alt-name-${i}`}
                label="Alternative Contact Name"
                required
                value={dep.alt_contact_name}
                onChange={(e) =>
                  updateDependent(i, {
                    alt_contact_name: e.currentTarget.value,
                  })
                }
              />
              <SimpleInput
                id={`dep-alt-phone-${i}`}
                label="Alternative Contact Phone Number"
                type="tel"
                required
                value={dep.alt_contact_phone}
                onChange={(e) =>
                  updateDependent(i, {
                    alt_contact_phone: e.currentTarget.value,
                  })
                }
              />
              <p className="mb-2 text-sm font-medium text-gray-700">
                Would you like the alternative contact phone number to be added
                to team WhatsApp groups?
              </p>
              <RadioButtons
                id={`dep-alt-whatsapp-${i}`}
                value={
                  dep.alt_contact_whatsapp_consent === null
                    ? undefined
                    : dep.alt_contact_whatsapp_consent
                      ? "yes"
                      : "no"
                }
                onChange={(val) =>
                  updateDependent(i, {
                    alt_contact_whatsapp_consent: val === "yes",
                  })
                }
                options={[
                  { title: "Yes", value: "yes" },
                  { title: "No", value: "no" },
                ]}
              />

              {errors[i] && (
                <p className="mt-1 text-sm text-red-600">{errors[i]}</p>
              )}
            </div>
          ))}

          <StepNav
            onBack={() => setStep("cricket")}
            onNext={() => validateAndAdvance("medical")}
            nextLabel="Next: Medical Information"
          />
        </>
      )}

      {/* Step 4: Medical information */}
      {step === "medical" && (
        <>
          {dependents.map((dep, i) => (
            <div
              key={i}
              className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h5 className="mb-3 text-sm font-semibold">{dep.name}</h5>

              {i > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mb-3"
                  onClick={() =>
                    updateDependent(i, {
                      gp_surgery: dependents[0].gp_surgery,
                      gp_phone: dependents[0].gp_phone,
                    })
                  }
                >
                  Copy GP details from {dependents[0].name || "Child 1"}
                </Button>
              )}

              <SimpleInput
                id={`dep-gp-surgery-${i}`}
                label="Name of GP's Surgery"
                required
                value={dep.gp_surgery}
                onChange={(e) =>
                  updateDependent(i, { gp_surgery: e.currentTarget.value })
                }
              />
              <SimpleInput
                id={`dep-gp-phone-${i}`}
                label="GP's Phone Number"
                type="tel"
                required
                value={dep.gp_phone}
                onChange={(e) =>
                  updateDependent(i, { gp_phone: e.currentTarget.value })
                }
              />

              <p className="mb-2 text-sm font-medium text-gray-700">
                Do you consider your child to have a disability?
              </p>
              <RadioButtons
                id={`dep-disability-${i}`}
                value={
                  dep.has_disability === null
                    ? undefined
                    : dep.has_disability
                      ? "yes"
                      : "no"
                }
                onChange={(val) =>
                  updateDependent(i, {
                    has_disability: val === "yes",
                    disability_type: val === "no" ? "" : dep.disability_type,
                  })
                }
                options={[
                  { title: "Yes", value: "yes" },
                  { title: "No", value: "no" },
                ]}
              />

              {dep.has_disability && (
                <>
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    What is the nature of the disability?
                  </p>
                  <RadioButtons
                    id={`dep-disability-type-${i}`}
                    value={dep.disability_type || undefined}
                    onChange={(val) =>
                      updateDependent(i, { disability_type: val })
                    }
                    options={DISABILITY_TYPES.map((opt) => ({
                      title: opt,
                      value: opt,
                    }))}
                  />
                </>
              )}

              <TextAreaInput
                id={`dep-medical-info-${i}`}
                label="Medical Information"
                value={dep.medical_info}
                placeholder="Please detail any important medical information (e.g. epilepsy, asthma, diabetes, allergies)"
                onChange={(val) => updateDependent(i, { medical_info: val })}
              />

              <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  I give my consent that in an emergency situation, the Club may
                  act in loco parentis to seek emergency medical treatment,
                  including anaesthetic if required.
                </p>
                <RadioButtons
                  id={`dep-emergency-consent-${i}`}
                  value={
                    dep.emergency_medical_consent === null
                      ? undefined
                      : dep.emergency_medical_consent
                        ? "yes"
                        : "no"
                  }
                  onChange={(val) =>
                    updateDependent(i, {
                      emergency_medical_consent: val === "yes",
                    })
                  }
                  options={[
                    { title: "Yes", value: "yes" },
                    { title: "No", value: "no" },
                  ]}
                />
              </div>

              <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  I confirm that to the best of my knowledge, my child does not
                  suffer from any medical condition other than those listed
                  above.
                </p>
                <RadioButtons
                  id={`dep-fitness-declaration-${i}`}
                  value={
                    dep.medical_fitness_declaration === null
                      ? undefined
                      : dep.medical_fitness_declaration
                        ? "yes"
                        : "no"
                  }
                  onChange={(val) =>
                    updateDependent(i, {
                      medical_fitness_declaration: val === "yes",
                    })
                  }
                  options={[
                    { title: "Yes", value: "yes" },
                    { title: "No", value: "no" },
                  ]}
                />
              </div>

              {errors[i] && (
                <p className="mt-1 text-sm text-red-600">{errors[i]}</p>
              )}
            </div>
          ))}

          <StepNav
            onBack={() => setStep("contact")}
            onNext={() => validateAndAdvance("consents")}
            nextLabel="Next: Consents"
          />
        </>
      )}

      {/* Step 5: Consents */}
      {step === "consents" && (
        <>
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h5 className="mb-2 text-sm font-semibold">Data Protection</h5>
            <p className="text-sm text-gray-600">
              Percy Main Cricket Club collects personal data to administer
              membership, organise cricket activities, and communicate with
              members. Your data is processed in accordance with our{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline hover:text-blue-900"
              >
                Privacy Policy
              </a>
              . As the person completing this form, you must ensure that each
              person whose information you include knows what will happen to
              their information.
            </p>
          </div>

          {dependents.map((dep, i) => (
            <div
              key={i}
              className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h5 className="mb-3 text-sm font-semibold">{dep.name}</h5>

              <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  I confirm I have read the Privacy Policy and consent to the
                  processing of my child&apos;s personal data as described.
                </p>
                <RadioButtons
                  id={`dep-data-consent-${i}`}
                  value={
                    dep.data_protection_consent === null
                      ? undefined
                      : dep.data_protection_consent
                        ? "yes"
                        : "no"
                  }
                  onChange={(val) =>
                    updateDependent(i, {
                      data_protection_consent: val === "yes",
                    })
                  }
                  options={[
                    { title: "Yes", value: "yes" },
                    { title: "No", value: "no" },
                  ]}
                />
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  I give my consent to my child being photographed and/or
                  videoed for the purposes of coaching and/or publicity.
                </p>
                <RadioButtons
                  id={`dep-photo-consent-${i}`}
                  value={
                    dep.photo_consent === null
                      ? undefined
                      : dep.photo_consent
                        ? "yes"
                        : "no"
                  }
                  onChange={(val) =>
                    updateDependent(i, {
                      photo_consent: val === "yes",
                    })
                  }
                  options={[
                    { title: "Yes", value: "yes" },
                    { title: "No", value: "no" },
                  ]}
                />
              </div>

              {errors[i] && (
                <p className="mt-1 text-sm text-red-600">{errors[i]}</p>
              )}
            </div>
          ))}

          <StepNav
            onBack={() => setStep("medical")}
            onNext={() => validateAndAdvance("review")}
            nextLabel="Review & Pay"
          />
        </>
      )}

      {/* Step 6: Review */}
      {step === "review" && (
        <>
          {dependents.map((dep, i) => (
            <div
              key={i}
              className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <h5 className="font-semibold">
                  {dep.name} — £{priceForChild(existingCount, i)}
                </h5>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="font-medium text-gray-500">Date of Birth</dt>
                <dd>{format(new Date(dep.dob), "dd/MM/yyyy")}</dd>
                <dt className="font-medium text-gray-500">Gender</dt>
                <dd className="capitalize">
                  {dep.sex === "prefer_not_to_say"
                    ? "Prefer not to say"
                    : dep.sex}
                </dd>
                <dt className="font-medium text-gray-500">School Year</dt>
                <dd>{dep.school_year}</dd>
                <dt className="font-medium text-gray-500">Played Before</dt>
                <dd>{dep.played_before ? "Yes" : "No"}</dd>
                {dep.played_before && dep.previous_cricket && (
                  <>
                    <dt className="font-medium text-gray-500">Where</dt>
                    <dd>{dep.previous_cricket}</dd>
                  </>
                )}
                <dt className="font-medium text-gray-500">Photo Consent</dt>
                <dd>{dep.photo_consent ? "Yes" : "No"}</dd>
              </dl>
            </div>
          ))}

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h5 className="mb-2 font-semibold">Payment Summary</h5>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2">Name</th>
                  <th className="pb-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {dependents.map((dep, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{dep.name}</td>
                    <td className="py-2 text-right">
                      £{priceForChild(existingCount, i)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-3">Total</td>
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

          <div className="mb-8 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("consents")}
            >
              Back
            </Button>
            <Button
              type="button"
              disabled={addDependentsMutation.isPending}
              onClick={handleSubmit}
            >
              {addDependentsMutation.isPending
                ? "Processing..."
                : "Confirm & Pay"}
            </Button>
          </div>
        </>
      )}

      <SocialMembershipUpsell />
    </div>
  );
};

const StepNav: FC<{
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
}> = ({ onBack, onNext, nextLabel }) => (
  <div className="mb-8 flex flex-wrap gap-3">
    <Button type="button" variant="outline" onClick={onBack}>
      Back
    </Button>
    <Button type="button" onClick={onNext}>
      {nextLabel}
    </Button>
  </div>
);

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
        className={buttonVariants({ variant: "outline" })}
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
