import { Component } from 'react';

/** 子でエラーが起きても画面全体が消えないよう fallback を表示する */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
