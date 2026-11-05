import type { ComponentProps } from "react";

/** Bordered table that scrolls sideways inside its own box on narrow screens. */
export function DataTable({ className = "", children, ...props }: ComponentProps<"table">) {
  return (
    <div className={`overflow-x-auto rounded-card border border-border bg-surface ${className}`}>
      <table className="w-full border-collapse" {...props}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className = "", ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-border bg-table-head px-3 py-2.5 text-left text-p3 font-semibold uppercase tracking-[0.3px] text-ink-muted ${className}`}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: ComponentProps<"td">) {
  return <td className={`border-b border-border-subtle px-3 py-3 align-middle text-p2 ${className}`} {...props} />;
}
