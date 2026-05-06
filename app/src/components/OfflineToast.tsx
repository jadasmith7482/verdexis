import { useEffect } from 'react'
import { toast } from 'sonner'

export default function OfflineToast() {
  useEffect(() => {
    let offlineId: string | number | undefined
    const goOffline = () => {
      offlineId = toast.error('You are offline — showing cached data', { duration: Infinity, id: 'offline' })
    }
    const goOnline = () => {
      if (offlineId !== undefined) toast.dismiss('offline')
      toast.success('Back online', { duration: 2000 })
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])
  return null
}
