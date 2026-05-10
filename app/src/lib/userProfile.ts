// Lightweight user-profile helpers backed by localStorage
const AUTH_KEY = 'verdexis_auth'
const AVATAR_KEY = 'verdexis_avatar'

export interface UserProfile {
  email: string
  name: string
  avatar?: string | null
  kycStatus?: 'none' | 'pending' | 'approved' | 'rejected'
}

export function getProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const auth = JSON.parse(raw)
    return {
      email: auth.email || '',
      name: auth.name || 'User',
      avatar: localStorage.getItem(AVATAR_KEY) || null,
      kycStatus: auth.kycStatus || 'none',
    }
  } catch {
    return null
  }
}

export function updateProfile(patch: Partial<UserProfile>): UserProfile | null {
  try {
    const current = getProfile() || { email: '', name: 'User', avatar: null, kycStatus: 'none' }
    const next = { ...current, ...patch }
    localStorage.setItem(AUTH_KEY, JSON.stringify({ email: next.email, name: next.name }))
    if (patch.avatar !== undefined) {
      if (patch.avatar) localStorage.setItem(AVATAR_KEY, patch.avatar)
      else localStorage.removeItem(AVATAR_KEY)
    }
    window.dispatchEvent(new Event('verdexis:profile'))
    return next
  } catch {
    return null
  }
}

export function getAvatar(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY)
  } catch {
    return null
  }
}

/** Resize an image File to a square data URL <= maxSize px, JPEG quality 0.85. */
export function fileToAvatarDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image must be smaller than 5 MB'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Invalid image'))
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        const canvas = document.createElement('canvas')
        canvas.width = maxSize
        canvas.height = maxSize
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas unavailable'))
          return
        }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
