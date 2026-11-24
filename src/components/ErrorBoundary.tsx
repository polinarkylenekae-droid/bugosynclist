import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected portal error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Portal ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 text-center shadow-sm space-y-3">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Something went wrong</h2>
            <p className="text-xs text-gray-600 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0c532b] hover:bg-[#094222] text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
