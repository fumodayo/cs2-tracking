import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-sm shadow-blue-950/10 hover:bg-accent-hover",
  secondary:
    "border border-border bg-secondary-btn text-secondary-btn-foreground shadow-sm hover:bg-secondary-btn-hover",
  outline:
    "border border-border bg-surface/40 text-foreground hover:bg-surface-hover",
  ghost:
    "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  danger:
    "border border-danger-border bg-danger-muted text-danger hover:bg-danger-muted",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  icon: "size-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild,
      children,
      className,
      variant = "primary",
      size = "md",
      type = "button",
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        type={asChild ? undefined : type}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";
