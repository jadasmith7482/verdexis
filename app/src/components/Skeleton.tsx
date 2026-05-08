import { cn } from '@/lib/utils'

/**
 * Drop-in skeleton placeholder. Use anywhere a card / row / chart is loading
 * to avoid the CLS jump from spinner -> content. Shimmer animates with CSS
 * keyframes defined in index.css.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-[#ffffff08] before:absolute before:inset-0 before:-translate-x-full before:animate-skeleton before:bg-gradient-to-r before:from-transparent before:via-[#ffffff08] before:to-transparent',
        className,
      )}
      {...props}
    />
  )
}

export default Skeleton
