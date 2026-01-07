import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  colorClass: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, colorClass }) => {
  return (
    <div className="bg-[#172e4d] rounded-xl p-6 shadow-lg border border-slate-700 flex items-start justify-between transition-all hover:border-slate-500 hover:shadow-xl">
      <div>
        <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        {trend && <p className="text-xs text-emerald-400 mt-2 font-medium">{trend}</p>}
      </div>
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-90`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  );
};