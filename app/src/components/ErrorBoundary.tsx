import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message?: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Verdexis] uncaught error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070C0E] flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 mx-auto mb-6 flex items-center justify-center text-red-400 text-2xl">!</div>
            <h1 className="text-2xl font-light text-[#E5E5E5] mb-3">Something went wrong</h1>
            <p className="text-sm text-[#A0A0A0] mb-6">An unexpected error occurred. The error has been logged. Try refreshing the page.</p>
            {this.state.message && (
              <pre className="text-[11px] text-[#737373] bg-[#0f1619] border border-[#ffffff08] rounded-lg p-3 text-left overflow-auto max-h-40 mb-6">{this.state.message}</pre>
            )}
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
              className="px-6 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] transition-colors"
            >Reload home</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
