import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandProps = {
  /** Pass `null` to render without a link. */
  href?: string | null;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
};

const sizes = {
  sm: 40,
  md: 56,
  lg: 112,
  hero: 128,
} as const;

export function Brand({
  href = "/",
  size = "md",
  className,
}: BrandProps) {
  const width = sizes[size];
  const content = (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/chopa-sub.png"
        alt="Chopa"
        width={width}
        height={Math.round(width * 0.45)}
        className="h-auto w-auto"
        priority={size === "hero" || size === "lg"}
      />
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href ?? "/"} className="inline-flex focus-visible:outline-none">
      {content}
    </Link>
  );
}
