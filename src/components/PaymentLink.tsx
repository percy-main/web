import type { Metadata } from "@/lib/payments/metadata";
import type { FC, ReactNode } from "react";

type Props = {
  priceId: string;
  metadata: Metadata;
  children: ReactNode;
  className?: string;
  email?: string;
};

export const PaymentLink: FC<Props> = ({
  priceId,
  metadata,
  className,
  children,
  email,
}) => {
  const searchParams = new URLSearchParams();
  searchParams.set("metadata", encodeURIComponent(JSON.stringify(metadata)));
  if (email) {
    searchParams.set("email", encodeURIComponent(email));
  }

  const href = `/purchase/${priceId}?${searchParams.toString()}`;
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
};
