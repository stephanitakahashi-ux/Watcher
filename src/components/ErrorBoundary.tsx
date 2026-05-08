import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>The app hit an error while loading. This often happens if saved browser data is corrupted.</p>
          <pre className="error-boundary-pre">{this.state.error.message}</pre>
          <p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem('screen-comparison-sessions')
                } catch {
                  /* ignore */
                }
                window.location.reload()
              }}
            >
              Clear saved sessions and reload
            </button>
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
