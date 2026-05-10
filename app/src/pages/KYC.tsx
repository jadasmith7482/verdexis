import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, Upload, CheckCircle, Clock, AlertCircle, User, Camera } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'

type KycStep = 'identity' | 'address' | 'selfie' | 'review' | 'done'

export default function KYC() { return <RequireAuth><KYCInner /></RequireAuth> }

function KYCInner() {
  const [step, setStep] = useState<KycStep>('identity')
  const [idType, setIdType] = useState('passport')
  const [idFile, setIdFile] = useState<string | null>(null)
  const [addressFile, setAddressFile] = useState<string | null>(null)
  const [selfieFile, setSelfieFile] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [country, setCountry] = useState('US')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const steps: { key: KycStep; label: string }[] = [
    { key: 'identity', label: 'Identity' },
    { key: 'address', label: 'Address' },
    { key: 'selfie', label: 'Selfie' },
    { key: 'review', label: 'Review' },
  ]
  const stepIdx = steps.findIndex(s => s.key === step)

  const fakeUpload = (setter: (v: string) => void) => {
    toast.success('Document uploaded')
    setter('uploaded')
  }

  const submit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1800))
    setSubmitting(false)
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
        <Navigation />
        <div className="text-center pt-24 max-w-md mx-auto px-6">
          <div className="w-16 h-16 rounded-full bg-[#0C8B44]/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[#0C8B44]" />
          </div>
          <h1 className="text-2xl font-light text-[#E5E5E5] mb-2">Verification Submitted</h1>
          <p className="text-sm text-[#737373] mb-6">Your documents are under review. This usually takes 1–2 business days. We'll notify you by email.</p>
          <div className="flex items-center gap-2 justify-center text-xs text-yellow-400 mb-8">
            <Clock className="w-4 h-4" />
            <span>Review in progress</span>
          </div>
          <Link to="/dashboard" className="inline-block px-6 py-3 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-xl hover:bg-[#0a7539] transition-colors">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <Link to="/settings" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to settings
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Identity Verification</h1>
              <p className="text-xs text-[#737373]">Required to unlock full withdrawal limits and fiat deposits.</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors ${i < stepIdx ? 'bg-[#0C8B44] text-white' : i === stepIdx ? 'border-2 border-[#0C8B44] text-[#0C8B44]' : 'bg-[#ffffff10] text-[#737373]'}`}>
                  {i < stepIdx ? <CheckCircle className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-[10px] uppercase tracking-wider hidden sm:block ${i === stepIdx ? 'text-[#E5E5E5]' : 'text-[#737373]'}`}>{s.label}</span>
                {i < steps.length - 1 && <div className={`flex-1 h-px ${i < stepIdx ? 'bg-[#0C8B44]' : 'bg-[#ffffff10]'}`} />}
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            {step === 'identity' && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2"><User className="w-4 h-4 text-[#0C8B44]" />Personal Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">First Name</label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Last Name</label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Date of Birth</label>
                  <input type="date" aria-label="Date of birth" value={dob} onChange={e => setDob(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Country of Citizenship</label>
                  <select aria-label="Country" value={country} onChange={e => setCountry(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="SG">Singapore</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">ID Document Type</label>
                  <select aria-label="ID type" value={idType} onChange={e => setIdType(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    <option value="passport">Passport</option>
                    <option value="dl">Driver's License</option>
                    <option value="id">Government ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Upload {idType === 'passport' ? 'Passport' : idType === 'dl' ? "Driver's License" : 'Government ID'}</label>
                  {idFile ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-[#0C8B44]" />
                      <span className="text-xs text-[#0C8B44]">Document uploaded successfully</span>
                    </div>
                  ) : (
                    <button onClick={() => fakeUpload(setIdFile)} className="w-full py-6 border-2 border-dashed border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/50 transition-colors flex flex-col items-center gap-2">
                      <Upload className="w-5 h-5 text-[#737373]" />
                      <span className="text-xs text-[#737373]">Click to upload or drag & drop</span>
                      <span className="text-[10px] text-[#737373]">JPG, PNG or PDF · Max 10 MB</span>
                    </button>
                  )}
                </div>
                <button onClick={() => { if (!firstName || !lastName || !dob || !idFile) { toast.error('Complete all fields'); return } setStep('address') }} className="w-full py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">
                  Continue
                </button>
              </div>
            )}

            {step === 'address' && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Residential Address</h2>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Street Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">City</label>
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="New York" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">ZIP / Postal Code</label>
                    <input value={zip} onChange={e => setZip(e.target.value)} placeholder="10001" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Proof of Address</label>
                  <p className="text-[11px] text-[#737373] mb-3">Bank statement, utility bill or government letter (dated within 90 days).</p>
                  {addressFile ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-[#0C8B44]" />
                      <span className="text-xs text-[#0C8B44]">Document uploaded successfully</span>
                    </div>
                  ) : (
                    <button onClick={() => fakeUpload(setAddressFile)} className="w-full py-6 border-2 border-dashed border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/50 transition-colors flex flex-col items-center gap-2">
                      <Upload className="w-5 h-5 text-[#737373]" />
                      <span className="text-xs text-[#737373]">Upload proof of address</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep('identity')} className="flex-1 py-2.5 border border-[#ffffff10] text-[#737373] text-xs rounded-lg hover:text-[#E5E5E5] transition-colors">Back</button>
                  <button onClick={() => { if (!address || !city || !zip || !addressFile) { toast.error('Complete all fields'); return } setStep('selfie') }} className="flex-1 py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">Continue</button>
                </div>
              </div>
            )}

            {step === 'selfie' && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-2 flex items-center gap-2"><Camera className="w-4 h-4 text-[#0C8B44]" />Selfie Verification</h2>
                <p className="text-xs text-[#737373]">Take a clear selfie holding your ID. Make sure your face and document are clearly visible.</p>
                <div className="rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-4">
                  <p className="text-xs text-[#E5E5E5] mb-2 font-medium">Tips for a good selfie</p>
                  <ul className="space-y-1 text-[11px] text-[#737373]">
                    <li>• Good lighting — no shadows on face</li>
                    <li>• Both your face and ID must be clearly visible</li>
                    <li>• Remove glasses, hats, or face coverings</li>
                    <li>• ID must be held flat, not folded</li>
                  </ul>
                </div>
                {selfieFile ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-[#0C8B44]" />
                    <span className="text-xs text-[#0C8B44]">Selfie uploaded successfully</span>
                  </div>
                ) : (
                  <button onClick={() => fakeUpload(setSelfieFile)} className="w-full py-10 border-2 border-dashed border-[#ffffff15] rounded-xl hover:border-[#0C8B44]/50 transition-colors flex flex-col items-center gap-3">
                    <Camera className="w-8 h-8 text-[#737373]" />
                    <span className="text-sm text-[#737373]">Upload selfie with ID</span>
                    <span className="text-[10px] text-[#737373]">JPG or PNG · Max 10 MB</span>
                  </button>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setStep('address')} className="flex-1 py-2.5 border border-[#ffffff10] text-[#737373] text-xs rounded-lg hover:text-[#E5E5E5] transition-colors">Back</button>
                  <button onClick={() => { if (!selfieFile) { toast.error('Upload a selfie'); return } setStep('review') }} className="flex-1 py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">Continue</button>
                </div>
              </div>
            )}

            {step === 'review' && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Review & Submit</h2>
                {[
                  { label: 'Full Name', value: `${firstName} ${lastName}` },
                  { label: 'Date of Birth', value: dob },
                  { label: 'Country', value: country },
                  { label: 'ID Type', value: idType },
                  { label: 'Address', value: `${address}, ${city} ${zip}` },
                  { label: 'Identity Document', value: '✓ Uploaded' },
                  { label: 'Proof of Address', value: '✓ Uploaded' },
                  { label: 'Selfie', value: '✓ Uploaded' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-[#ffffff05] text-xs">
                    <span className="text-[#737373]">{row.label}</span>
                    <span className="text-[#E5E5E5]">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-start gap-2 rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-3 mt-4">
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#737373]">By submitting you confirm that all information is accurate and agree to our identity verification terms. Review typically takes 1–2 business days.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep('selfie')} className="flex-1 py-2.5 border border-[#ffffff10] text-[#737373] text-xs rounded-lg hover:text-[#E5E5E5] transition-colors">Back</button>
                  <button onClick={submit} disabled={submitting} className="flex-1 py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-60">
                    {submitting ? 'Submitting…' : 'Submit for Review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
