// Floating WhatsApp chat button — pinned bottom-right on every page.
// Uses the same number / wa.me deep link as the footer.

const CONTACT_PHONE_DISPLAY = '+1 (719) 679-8790'
const CONTACT_PHONE_E164 = '17196798790'
const WHATSAPP_URL = `https://wa.me/${CONTACT_PHONE_E164}?text=${encodeURIComponent(
  "Hi Verdexis — I'd like some help."
)}`

export default function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with Verdexis support on WhatsApp at ${CONTACT_PHONE_DISPLAY}`}
      title={`WhatsApp support · ${CONTACT_PHONE_DISPLAY}`}
      className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 hover:bg-[#1ebe5b] hover:scale-105 transition-all"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="w-7 h-7"
        fill="currentColor"
      >
        <path d="M19.11 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.43 1.32 4.92L2 22l5.32-1.4a9.86 9.86 0 0 0 4.71 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.84-6.98zM12.04 20.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.16.83.84-3.08-.2-.32a8.21 8.21 0 0 1-1.26-4.32c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.21-8.22 8.21zm4.74-6.16c-.26-.13-1.54-.76-1.78-.85-.24-.09-.41-.13-.59.13-.17.26-.67.85-.83 1.02-.15.17-.31.2-.57.07-.26-.13-1.1-.4-2.1-1.29-.78-.69-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.26-.31.39-.46.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.59-1.42-.81-1.95-.21-.51-.43-.44-.59-.45h-.5c-.17 0-.45.06-.69.32-.24.26-.91.89-.91 2.17 0 1.28.93 2.51 1.06 2.69.13.17 1.83 2.79 4.43 3.91.62.27 1.1.43 1.48.55.62.2 1.19.17 1.64.1.5-.07 1.54-.63 1.76-1.24.22-.61.22-1.13.15-1.24-.07-.11-.24-.17-.5-.3z" />
      </svg>
    </a>
  )
}
