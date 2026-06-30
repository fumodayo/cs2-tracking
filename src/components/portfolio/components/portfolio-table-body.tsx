import { memo } from "react";
import { flexRender, type Table, type Row } from "@tanstack/react-table";
import type { PortfolioTableRow } from "../portfolio-table-model";

interface PortfolioTableBodyProps {
  table: Table<PortfolioTableRow>;
}

function PortfolioTableRowComponent({
  row,
  isSelected,
}: {
  row: Row<PortfolioTableRow>;
  isSelected: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextSibling = e.currentTarget.nextElementSibling as HTMLTableRowElement | null;
      if (nextSibling) {
        nextSibling.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevSibling = e.currentTarget.previousElementSibling as HTMLTableRowElement | null;
      if (prevSibling) {
        prevSibling.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const editButton = e.currentTarget.querySelector('button[title*="lots"], button[title*="Lots"]') as HTMLButtonElement | null;
      if (editButton) {
        editButton.click();
      }
    }
  };

  return (
    <tr
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`transition-colors outline-none focus:bg-stone-800/80 focus:ring-1 focus:ring-accent/40 ${
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
  );
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
                  aria-sort={
                    header.column.getCanSort()
                      ? (header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : "none")
                      : undefined
                  }
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
            <PortfolioTableRowComponent
              key={row.id}
              row={row}
              isSelected={row.getIsSelected()}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
