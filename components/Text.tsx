import React from 'react'

type Props = {
  children: React.ReactNode
  className?: string
}

export default function Text({ children, className }: Props) {
  // Minimal pass-through Text component to satisfy lint/type checks.
  // You can enhance this later with typography, i18n, or analytics.
  return <span className={className}>{children}</span>
}
