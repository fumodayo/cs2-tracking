"use client";

import { useEffect, useRef } from "react";
import { useInView, animate } from "framer-motion";

export const CountUp = ({
  to,
  from = 0,
  duration = 1.25,
  separator = ".",
  decimals = 0,
}: {
  to: number;
  from?: number;
  duration?: number;
  separator?: string;
  decimals?: number;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  useEffect(() => {
    if (isInView) {
      const controls = animate(from, to, {
        duration: duration,
        ease: "easeOut",
        onUpdate(value) {
          if (ref.current) {
            ref.current.textContent = Intl.NumberFormat("en-US", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
              .format(value)
              .replace(/,/g, separator);
          }
        },
      });
      return () => controls.stop();
    }
  }, [isInView, from, to, duration, decimals, separator]);

  return <span ref={ref}>{from}</span>;
};
