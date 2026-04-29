import type { PropsWithChildren } from "react";

export function PageHeader({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h2 className="text-2xl font-semibold tracking-normal">{title}</h2>
      {children}
    </div>
  );
}
