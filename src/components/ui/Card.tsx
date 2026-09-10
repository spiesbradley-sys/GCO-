import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// White card on the fog page, 12px radius, resting shadow, 24px padding.
export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return (
    <Tag className={cn('rounded-card bg-surface-card p-6 shadow-sm', className)}>{children}</Tag>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('font-heading text-card-title', className)}>{children}</h3>;
}
