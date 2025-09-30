import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-arabic transition-smooth focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gradient-primary text-primary-foreground hover:shadow-sm",
        secondary: "border-transparent bg-gradient-surface text-secondary-foreground hover:bg-secondary/80",
        success: "border-transparent bg-gradient-success text-success-foreground hover:shadow-sm",
        warning: "border-transparent bg-gradient-warning text-warning-foreground hover:shadow-sm",
        danger: "border-transparent bg-gradient-danger text-danger-foreground hover:shadow-sm",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
