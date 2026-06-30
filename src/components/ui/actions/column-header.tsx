import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  align?: "left" | "right";
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  align = "left",
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { t } = useTranslation();

  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const isSorted = column.getIsSorted();

  return (
    <div className={cn("flex items-center", align === "right" && "justify-end", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2 -mx-2 font-medium hover:bg-stone-800/80 hover:text-white focus:outline-none cursor-pointer data-[state=open]:bg-stone-800/80",
              align === "right" ? "w-full justify-end text-right" : "justify-start text-left"
            )}
          >
            <span>{title}</span>
            {isSorted === "desc" ? (
              <ArrowDown className="ml-1 size-3 text-accent shrink-0" />
            ) : isSorted === "asc" ? (
              <ArrowUp className="ml-1 size-3 text-accent shrink-0" />
            ) : (
              <ArrowUpDown className="ml-1 size-3 text-stone-500 shrink-0" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align === "right" ? "end" : "start"} className="w-32 bg-stone-950 border-stone-800">
          <DropdownMenuItem
            onClick={() => column.toggleSorting(false)}
            className="flex items-center gap-2 cursor-pointer text-stone-200 focus:bg-stone-900 focus:text-stone-100"
          >
            <ArrowUp className="size-3.5 text-stone-400" />
            <span>{t("common.sortAsc", "Asc")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => column.toggleSorting(true)}
            className="flex items-center gap-2 cursor-pointer text-stone-200 focus:bg-stone-900 focus:text-stone-100"
          >
            <ArrowDown className="size-3.5 text-stone-400" />
            <span>{t("common.sortDesc", "Desc")}</span>
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => column.toggleVisibility(false)}
                className="flex items-center gap-2 cursor-pointer text-stone-200 focus:bg-stone-900 focus:text-stone-100"
              >
                <EyeOff className="size-3.5 text-stone-400" />
                <span>{t("common.hideColumn", "Hide")}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
