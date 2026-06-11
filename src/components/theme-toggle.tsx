"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/utils/cn";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup.Root
      type="single"
      value={theme}
      onValueChange={(value) => {
        if (value === "light" || value === "dark") {
          setTheme(value);
        }
      }}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface-muted p-1"
      aria-label="Chọn giao diện"
    >
      <ToggleGroup.Item
        value="light"
        className={cn(
          "grid size-7 place-items-center rounded text-muted-foreground transition",
          theme === "light" &&
            "bg-accent text-accent-foreground",
        )}
        aria-label="Light mode"
      >
        <Sun className="size-4" />
      </ToggleGroup.Item>
      <ToggleGroup.Item
        value="dark"
        className={cn(
          "grid size-7 place-items-center rounded text-muted-foreground transition",
          theme === "dark" &&
            "bg-accent text-accent-foreground",
        )}
        aria-label="Dark mode"
      >
        <Moon className="size-4" />
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}
