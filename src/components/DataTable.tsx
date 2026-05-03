import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  className?: string;
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyLabel?: string;
}

export function DataTable<TData>({ className, columns, data, emptyLabel = "Aucun résultat" }: DataTableProps<TData>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-white", className)}>
      <table className="w-full text-left text-sm">
        <thead className="animate-fade-in bg-muted text-xs uppercase text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th className="px-4 py-3 font-semibold" key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row, index) => (
              <tr
                className="animate-fade-in animate-slide-in-up border-t border-border transition-colors duration-300 hover:bg-muted/50"
                key={row.id}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td className="px-4 py-3" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-4 py-8 text-center text-muted-foreground" colSpan={columns.length}>
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
