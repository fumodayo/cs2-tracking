"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-red-200/50 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 backdrop-blur-md max-w-lg mx-auto my-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
            Đã xảy ra lỗi hệ thống
          </h3>
          <p className="text-sm text-red-700/80 dark:text-red-400/80 mb-6 max-h-24 overflow-y-auto font-mono text-left w-full p-3 bg-red-100/50 dark:bg-red-950/20 rounded border border-red-200/20">
            {this.state.error?.message || "Lỗi không xác định trong component."}
          </p>
          <Button
            onClick={this.handleReset}
            variant="outline"
            className="flex items-center gap-2 border-red-200 hover:bg-red-100/50 dark:border-red-900/40 dark:hover:bg-red-950/30 text-red-700 dark:text-red-300"
          >
            <RotateCcw className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
