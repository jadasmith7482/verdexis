import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  resetKey?: string
  scope?: string
}
interface State { hasError: boolean; message?: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    let msg = error?.message || 'Unknown error'
    if (/null is not an object|Cannot read propert(?:y|ies) of (?:null|undefined)/i.test(msg)) {
      msg = 'A piece of data was missing from the server response. ' + msg
    }
    return { hasError: true, message: msg }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Verdexis] uncaught error', error, info)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: undefined })
    }
  }

  private retry = () => {
    this.setState({ hasError: false, message: undefined })
  }

  private hardReload = () => {
    try {
      const keep = new Set(['verdexis:token', 'verdexis:admin', 'verdexis:user'])
      const drop: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && !keep.has(k)) drop.push(k)
      }
      drop.forEach((k) => localStorage.removeItem(k))
    } catch { /* ignore */ }
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] bg-[#070C0E] flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 mx-auto mb-6 flex items-center justify-center text-red-400 text-2xl">!</div>
            <h1 className="text-2xl font-light text-[#E5E5E5] mb-3">Something went wrong{this.props.scope ? ` on ${this.props.scope}` : ''}</h1>
            <p className="text-sm text-[#A0A0A0] mb-6">An unexpected error occurred. Try again, or reload to clear cached data.</p>
            {this.state.message && (
              <pre className="text-[11px] text-[#737373] bg-[#0f1619] border border-[#ffffff08] rounded-lg p-3 text-left overflow-auto max-h-40 mb-6">{this.state.message}</pre>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={this.retry}
                className="px-6 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] transition-colors"
              >Try again</button>
              <button
                onClick={this.hardReload}
                className="px-6 py-2.5 bg-[#0f1619] border border-[#ffffff10] text-[#E5E5E5] text-sm rounded-lg hover:border-[#0C8B44]/40 transition-colors"
              >Reload and clear cache</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
