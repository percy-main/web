import type { Metadata } from "@/lib/payments/metadata";
import type { FC, ReactNode } from "react";

type Props = {
  priceId: string;
  metadata: Metadata;
  children: ReactNode;
  className?: string;
};

export const PaymentLink: FC<Props> = ({
  priceId,
  metadata,
  className,
  children,
}) => (
  <a
    href={`/purchase/${priceId}?metadata=${JSON.stringify(metadata)}`}
    className={className}
  >
    {children}
  </a>
);
