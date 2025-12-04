import { cn, getStatusLabel, getStatusColor, getMaintenanceTypeLabel, getMaintenanceTypeColor } from '@/lib/utils';
import { RequestStatus, MaintenanceType } from '@/types';

interface StatusBadgeProps {
  status: RequestStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        getStatusColor(status),
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

interface MaintenanceTypeBadgeProps {
  type: MaintenanceType;
  className?: string;
}

export function MaintenanceTypeBadge({ type, className }: MaintenanceTypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        getMaintenanceTypeColor(type),
        className
      )}
    >
      {getMaintenanceTypeLabel(type)}
    </span>
  );
}






