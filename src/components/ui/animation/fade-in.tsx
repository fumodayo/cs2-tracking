"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface FadeInProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  fullWidth?: boolean;
}

export const FadeIn = ({
  children,
  delay = 0,
  direction = "up",
  fullWidth = false,
  className,
  ...props
}: FadeInProps) => {
  const directions = {
    up: { y: 20, x: 0 },
    down: { y: -20, x: 0 },
    left: { x: 20, y: 0 },
    right: { x: -20, y: 0 },
    none: { x: 0, y: 0 },
  };

  return (
    <motion.div
      initial={{
        opacity: 0,
        ...directions[direction],
      }}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
      }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{
        duration: 0.5,
        delay: delay,
        ease: [0.25, 0.25, 0, 1],
      }}
      className={cn(fullWidth && "w-full", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};
