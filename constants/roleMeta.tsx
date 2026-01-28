import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Crown, Swords, Anchor, Briefcase, Heart } from 'lucide-react';
import { Role } from '../types';

export interface RoleMeta {
  icon: LucideIcon;
  /** Tailwind color: bg-{color}-100 text-{color}-700 border-{color}-200 */
  color: 'violet' | 'red' | 'blue' | 'amber' | 'rose';
}

export const ROLE_META: Record<Role, RoleMeta> = {
  [Role.DUKE]: { icon: Crown, color: 'violet' },
  [Role.ASSASSIN]: { icon: Swords, color: 'red' },
  [Role.CAPTAIN]: { icon: Anchor, color: 'blue' },
  [Role.AMBASSADOR]: { icon: Briefcase, color: 'amber' },
  [Role.CONTESSA]: { icon: Heart, color: 'rose' },
};

const colorClasses: Record<RoleMeta['color'], string> = {
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
};

export function getRoleChipClass(role: Role): string {
  return colorClasses[ROLE_META[role].color];
}

/** Inline role display: icon + i18n label */
export const RoleChip: React.FC<{ role: Role; label: string; size?: 'sm' | 'md' }> = ({ role, label, size = 'md' }) => {
  const { icon: Icon } = ROLE_META[role];
  const cls = colorClasses[ROLE_META[role].color];
  const isSm = size === 'sm';
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${cls} ${isSm ? 'text-xs' : 'text-xs'}`}>
      <Icon size={isSm ? 12 : 14} strokeWidth={2} />
      {label}
    </span>
  );
};
