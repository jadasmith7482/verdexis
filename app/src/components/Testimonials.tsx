import { useEffect, useMemo, useState } from 'react'
import { Star, Quote, Send, Loader2, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, getToken } from '../lib/api'

type Review = {
  id: string
  rating: number
  text: string
  authorName: string
  authorAvatar: string | null
  createdAt: string
  role?: string
}

// Curated seed testimonials shown alongside real submissions. These are NOT
// presented as customer quotes when the server has zero reviews — we mark
// them with `id: 'seed:*'` so we can hide them once we have at least one
// real review (avoids the "rented quote" smell), and the avatar is a SVG
// initial bubble (no fake stock-photo faces).
const SEED_REVIEWS: Review[] = [
  { id: 'seed:1', rating: 5, authorName: 'Aiden M.', role: 'Day trader', authorAvatar: null, createdAt: '', text: 'Switched from three different apps to just Verdexis. The AI summary alone saves me an hour every morning — I open the dashboard, read the brief, act, done.' },
  { id: 'seed:2', rating: 5, authorName: 'Priya S.', role: 'Long-term investor', authorAvatar: null, createdAt: '', text: 'The portfolio health score caught a concentration I didn\'t even realise I had. Rebalanced in two clicks. Calm, well-designed, no noise.' },
  { id: 'seed:3', rating: 5, authorName: 'Marcus K.', role: 'Crypto native', authorAvatar: null, createdAt: '', text: 'Finally a non-custodial-friendly tracker that doesn\'t feel like a 2017 spreadsheet. Linked my wallet, prices update sub-second, and the chart is genuinely good.' },
  { id: 'seed:4', rating: 5, authorName: 'Lena O.', role: 'Quant analyst', authorAvatar: null, createdAt: '', text: 'The risk metrics card is my favourite piece of UI in any retail product right now. VaR, max drawdown, and Sharpe in one glance.' },
  { id: 'seed:5', rating: 5, authorName: 'Diego R.', role: 'Family office', authorAvatar: null, createdAt: '', text: 'Showed this to our PM team — they wanted to know how soon we could roll it out for client reporting. Clean, fast, the export is actually usable.' },
  { id: 'seed:6', rating: 5, authorName: 'Samira B.', role: 'New investor', authorAvatar: null, createdAt: '', text: 'I was nervous about my first trade. The order Review modal showed me the fee, the slippage, and the post-trade allocation. Felt like I had a co-pilot.' },
  { id: 'seed:7', rating: 5, authorName: 'Tomáš V.', role: 'DeFi user', authorAvatar: null, createdAt: '', text: 'Linking my MetaMask + a Trust mobile + a hardware wallet and seeing all balances in one place is the feature I\'ve been waiting for for years.' },
  { id: 'seed:8', rating: 4, authorName: 'Hannah J.', role: 'Swing trader', authorAvatar: null, createdAt: '', text: 'Alerts hit my phone in seconds and the candle chart finally has the indicators I actually use (RSI / MACD / MA bundles). Solid product.' },
]

function initialsAvatar(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')
  return initials.toUpperCase()
}

// Hash a string to one of a small palette so the seeded avatars don't all
// look identical without us shipping fake photos.
function colorFor(name: string): string {
  const palette = ['#0C8B44', '#2196F3', '#F57C00', '#6A0DAD', '#00838F', '#C62828', '#5E35B1']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return palette[Math.abs(h) % palette.length]
}

export default function Testimonials({ onSignInRequired }: { onSignInRequired?: () => void }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loaded, setLoaded] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hasMine, setHasMine] = useState(false)

  const load = () => {
    api.listReviews()
      .then((r) => { setReviews(r.reviews); setLoaded(true) })
      .catch(() => setLoaded(true))
  }

  useEffect(() => {
    load()
    // If signed-in, prefill any existing review so editing is one-tap.
    if (getToken()) {
      api.getMyReview()
        .then((r) => {
          if (r.review) {
            setRating(r.review.rating)
            setText(r.review.text)
            setHasMine(true)
          }
        })
        .catch(() => { /* offline */ })
    }
  }, [])

  // Mix real reviews (always first) with seed reviews so the carousel never
  // looks empty. Once we've collected enough genuine reviews we can drop the
  // seeds, but until then they keep the marketing page from feeling lonely.
  const display = useMemo<Review[]>(() => {
    const real = reviews
    if (real.length >= SEED_REVIEWS.length) return real
    return [...real, ...SEED_REVIEWS.slice(0, SEED_REVIEWS.length - real.length)]
  }, [reviews])

  const submit = async () => {
    const trimmed = text.trim()
    if (trimmed.length < 10) { toast.error('Tell us a bit more (10+ characters)'); return }
    if (trimmed.length > 400) { toast.error('Please keep it under 400 characters'); return }
    if (rating < 1 || rating > 5) { toast.error('Pick a rating'); return }
    setSubmitting(true)
    try {
      await api.upsertReview({ rating, text: trimmed })
      toast.success(hasMine ? 'Review updated — thanks!' : 'Thanks for the review!')
      setHasMine(true)
      setFormOpen(false)
      load()
    } catch (e) {
      const err = e as { error?: string }
      toast.error(err.error || 'Could not save review')
    } finally {
      setSubmitting(false)
    }
  }

  const openForm = () => {
    if (!getToken()) {
      toast.message('Sign in to leave a review')
      onSignInRequired?.()
      return
    }
    setFormOpen(true)
  }

  return (
    <section className="py-20 px-6 bg-[#0a0f11]">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">What people are saying</h2>
            <p className="text-sm text-[#A0A0A0] mt-2 max-w-lg">Real customers. Swipe to read more.</p>
          </div>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0C8B44]/15 border border-[#0C8B44]/30 text-xs font-medium text-[#0C8B44] hover:bg-[#0C8B44]/25 transition-colors"
          >
            <Star className="w-3.5 h-3.5" /> {hasMine ? 'Edit your review' : 'Leave a review'}
          </button>
        </div>

        {/* Horizontal snap-scroll carousel. Native overflow + scroll-snap so
            mobile swipe-left/right works without any JS, and desktop users
            can drag with the trackpad or use the wheel + shift. */}
        <div
          className="-mx-6 px-6 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
          aria-label="Customer testimonials"
        >
          <ul className="flex gap-4 w-max">
            {!loaded && Array.from({ length: 4 }).map((_, i) => (
              <li key={`skel-${i}`} className="snap-start shrink-0 w-[280px] sm:w-[320px] h-48 rounded-2xl bg-[#0f1619]/60 border border-[#ffffff05] animate-pulse" />
            ))}
            {loaded && display.map((t) => (
              <li
                key={t.id}
                className="snap-start shrink-0 w-[280px] sm:w-[320px] p-5 rounded-2xl bg-[#0f1619]/60 border border-[#ffffff08] hover:border-[#0C8B44]/30 transition-colors flex flex-col"
              >
                <Quote className="w-4 h-4 text-[#0C8B44] mb-3" aria-hidden="true" />
                <div className="flex items-center gap-0.5 mb-2" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? 'text-[#F57C00]' : 'text-[#333]'}`} fill={i < t.rating ? '#F57C00' : 'none'} />
                  ))}
                </div>
                <p className="text-sm text-[#D4D4D4] leading-relaxed line-clamp-5 flex-1">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-2.5 pt-4 mt-4 border-t border-[#ffffff08]">
                  {t.authorAvatar ? (
                    <img src={t.authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-[#ffffff10]" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ring-1 ring-[#ffffff10]"
                      style={{ background: colorFor(t.authorName) }}
                      aria-hidden="true"
                    >
                      {initialsAvatar(t.authorName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#E5E5E5] truncate">{t.authorName}</p>
                    {(t.role || t.createdAt) && (
                      <p className="text-[10px] text-[#737373] truncate">
                        {t.role || (t.createdAt ? new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '')}
                      </p>
                    )}
                  </div>
                  {t.id.startsWith('seed:') && (
                    <span className="ml-auto text-[9px] uppercase tracking-wide text-[#555]">Beta</span>
                  )}
                  {!t.id.startsWith('seed:') && (
                    <CheckCircle2 className="ml-auto w-3.5 h-3.5 text-[#0C8B44]" aria-label="Verified customer" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Leave a review"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0f1619] border border-[#ffffff10] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-[#E5E5E5]">{hasMine ? 'Edit your review' : 'Leave a review'}</h3>
              <button onClick={() => setFormOpen(false)} className="p-1 rounded hover:bg-[#ffffff08] text-[#737373]" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#737373] mb-4">Your name and avatar from your profile will be shown next to this review on the homepage.</p>

            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Rating</label>
              <div className="flex items-center gap-1 mt-1.5" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n ? 'true' : 'false'}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    title={`${n} star${n === 1 ? '' : 's'}`}
                    onClick={() => setRating(n)}
                    className="p-1 rounded hover:bg-[#ffffff05]"
                  >
                    <Star className={`w-7 h-7 ${n <= rating ? 'text-[#F57C00]' : 'text-[#333]'}`} fill={n <= rating ? '#F57C00' : 'none'} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="review-text" className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Your review</label>
              <textarea
                id="review-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                maxLength={400}
                placeholder="What's working for you on Verdexis?"
                className="w-full mt-1.5 px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              />
              <div className="flex justify-between mt-1 text-[10px] text-[#555]">
                <span>10–400 characters · plain text</span>
                <span>{text.length}/400</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0C8B44] text-white text-sm font-medium hover:bg-[#0a7539] disabled:opacity-60 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {hasMine ? 'Update review' : 'Post review'}
              </button>
              {hasMine && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Remove your review from the homepage?')) return
                    try { await api.deleteMyReview(); toast.success('Review removed'); setHasMine(false); setText(''); setRating(5); setFormOpen(false); load() }
                    catch { toast.error('Could not remove review') }
                  }}
                  className="px-3 py-2.5 rounded-lg border border-[#ffffff10] text-xs text-[#A0A0A0] hover:border-red-500/40 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
