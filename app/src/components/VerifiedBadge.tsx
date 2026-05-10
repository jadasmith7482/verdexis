const VERIFIED_ICON_URL = 'https://img.icons8.com/3d-fluency/96/verified-account.png'

/** Icons8 3D Fluency verification badge (icon only). */
export default function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <img
      src={VERIFIED_ICON_URL}
      alt="Verified"
      width={22}
      height={22}
      loading="lazy"
      decoding="async"
      className={`inline-block h-[22px] w-[22px] flex-shrink-0 select-none ${className}`}
    />
  )
}
