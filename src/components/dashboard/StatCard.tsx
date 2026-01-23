import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

const variantStyles = {
  default: 'bg-card stat-card-gradient',
  warning: 'bg-warning/5 border-warning/20',
  danger: 'bg-destructive/5 border-destructive/20',
  success: 'bg-success/5 border-success/20',
};

const iconStyles = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/15 text-destructive',
  success: 'bg-success/15 text-success',
};

export function StatCard({ title, value, icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn('stat-card fade-in', variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-bold text-foreground tracking-tight">{value}</p>
          {trend && (
            <p className={cn(
              'mt-2 text-sm font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}% from yesterday
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconStyles[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
