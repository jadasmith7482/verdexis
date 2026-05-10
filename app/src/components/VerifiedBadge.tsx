import { BadgeCheck } from 'lucide-react'

export default function VerifiedBadge({ className = '', label = 'Verified' }: { className?: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[#3b82f6]/30 bg-gradient-to-r from-[#3b82f6]/15 to-[#2563eb]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#93c5fd] shadow-[0_0_0_1px_rgba(59,130,246,0.08)] ${className}`}
    >
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-sm shadow-[#3b82f6]/30">
        <BadgeCheck className="h-2.5 w-2.5" />
      </span>
      <span>{label}</span>
    </span>
  )
}
