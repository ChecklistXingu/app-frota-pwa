import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div className={cn("animate-pulse rounded-xl bg-slate-100", className)} {...props} />
);

export { Skeleton };
