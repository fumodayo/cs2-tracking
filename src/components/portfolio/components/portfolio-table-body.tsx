import { flexRender, type Table } from "@tanstack/react-table";
import type { PortfolioTableRow } from "../portfolio-table-model";

interface PortfolioTableBodyProps {
  table: Table<PortfolioTableRow>;
}

export function PortfolioTableBody({ table }: PortfolioTableBodyProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left text-sm text-stone-300">
        <thead className="bg-stone-900/80 text-xs uppercase text-stone-400">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-5 py-3 font-medium ${
                    header.column.id === "select"
                      ? "text-center w-12"
                      : header.column.id !== "case"
                      ? "text-right"
                      : ""
                  }`}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-stone-800 bg-stone-900/20">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`transition-colors ${
                row.original.sourceType === "manual"
                  ? "bg-blue-500/[0.04] border-l-2 border-l-blue-500 hover:bg-blue-500/[0.08]"
                  : "hover:bg-stone-800/50"
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-5 py-4 align-middle ${
                    cell.column.id === "select"
                      ? "text-center w-12"
                      : cell.column.id !== "case"
                      ? "text-right"
                      : ""
                  }`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
