import React, { useMemo } from 'react';
import { AlertTriangle, AlertOctagon, Info, CheckCircle, Calendar, Clock, Activity, MousePointerClick } from 'lucide-react';
import { WorkLog } from '../types';

interface ControlPanelProps {
  data: WorkLog[];
  selectedMonths: string[];
  onFilterByIds: (ids: string[]) => void; // New prop to communicate back to App
}

interface Alert {
  type: 'critical' | 'warning' | 'info';
  title: string;
  consultant: string;
  detail: string;
  value: string;
  relatedIds: string[]; // Store the IDs that caused this alert
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ data, selectedMonths, onFilterByIds }) => {
  // Determine context regarding time period
  const isSingleMonth = selectedMonths.length === 1;

  const alerts = useMemo(() => {
    const generatedAlerts: Alert[] = [];
    if (data.length === 0) return generatedAlerts;

    // --- CONTEXTO TEMPORAL (DYNAMIC LOGIC) ---
    const now = new Date();
    let isCurrentMonthSelected = false;
    let businessDaysToDate = 0;
    
    if (isSingleMonth) {
      const [selYear, selMonth] = selectedMonths[0].split('-').map(Number);
      if (now.getFullYear() === selYear && (now.getMonth() + 1) === selMonth) {
        isCurrentMonthSelected = true;
        const currentDay = now.getDate();
        for (let d = 1; d <= currentDay; d++) {
          const tempDate = new Date(selYear, selMonth - 1, d);
          const dayOfWeek = tempDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
            businessDaysToDate++;
          }
        }
      }
    }

    const expectedHoursFT = businessDaysToDate * 8;
    const expectedHoursPT = businessDaysToDate * 4;

    // --- AGRUPACIÓN DE DATOS ---
    const consultantStats: Record<string, { 
      hours: number; 
      type: string; 
      weekendHours: number;
      weekendIds: string[]; // Store weekend log IDs
      days: Record<string, number>; // date -> hours
      dayIds: Record<string, string[]>; // date -> list of log IDs
      allIds: string[]; // All IDs for this consultant (for general low/high load alerts)
    }> = {};

    data.forEach(log => {
      if (!consultantStats[log.consultant]) {
        consultantStats[log.consultant] = { 
          hours: 0, 
          type: log.consultantType || 'No definido', 
          weekendHours: 0, 
          weekendIds: [],
          days: {},
          dayIds: {},
          allIds: []
        };
      }
      const stats = consultantStats[log.consultant];
      stats.hours += log.hours;
      stats.allIds.push(log.id);
      
      if (stats.type === 'No definido' && log.consultantType) {
        stats.type = log.consultantType;
      }

      // Check Weekend
      const dateParts = log.date.split('-');
      if (dateParts.length === 3) {
        const d = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const day = d.getDay();
        if (day === 0 || day === 6) { 
          stats.weekendHours += log.hours;
          stats.weekendIds.push(log.id);
        }
      }

      // Track daily load
      stats.days[log.date] = (stats.days[log.date] || 0) + log.hours;
      
      // Track IDs per day
      if (!stats.dayIds[log.date]) {
        stats.dayIds[log.date] = [];
      }
      stats.dayIds[log.date].push(log.id);
    });

    // --- REGLAS DE NEGOCIO ---
    Object.entries(consultantStats).forEach(([name, stats]) => {
      const isFullTime = stats.type.toLowerCase().includes('full') || stats.type === 'No definido';
      const isPartTime = stats.type.toLowerCase().includes('part');

      // 1. CONTROL DE CARGA
      if (isSingleMonth) {
        if (isCurrentMonthSelected) {
          // Dynamic
          if (isFullTime && stats.hours < expectedHoursFT) {
             const diff = expectedHoursFT - stats.hours;
             if (diff > 2) {
                generatedAlerts.push({
                  type: 'critical',
                  title: 'Atraso en Carga (Al día de hoy)',
                  consultant: name,
                  detail: `A la fecha debería tener ${expectedHoursFT}hs. Faltan ${diff.toFixed(1)}hs.`,
                  value: `${stats.hours.toFixed(1)} / ${expectedHoursFT}hs`,
                  relatedIds: stats.allIds // Show all records to let user see what IS loaded
                });
             }
          }
          if (isPartTime && stats.hours < expectedHoursPT) {
             const diff = expectedHoursPT - stats.hours;
             if (diff > 2) {
                generatedAlerts.push({
                  type: 'warning',
                  title: 'Atraso Part-Time',
                  consultant: name,
                  detail: `Debería tener ${expectedHoursPT}hs.`,
                  value: `${stats.hours.toFixed(1)} / ${expectedHoursPT}hs`,
                  relatedIds: stats.allIds
                });
             }
          }
        } else {
          // Static Closing
          if (isFullTime && stats.hours < 140) {
            generatedAlerts.push({
              type: 'critical',
              title: 'Baja Utilización (Cierre)',
              consultant: name,
              detail: `Cerró con menos de 140hs.`,
              value: `${stats.hours.toFixed(0)}hs`,
              relatedIds: stats.allIds
            });
          }
          if (isPartTime && stats.hours > 80) {
            generatedAlerts.push({
              type: 'warning',
              title: 'Exceso Horas (Part Time)',
              consultant: name,
              detail: `Superó el límite de 80hs.`,
              value: `+${(stats.hours - 80).toFixed(0)}hs`,
              relatedIds: stats.allIds
            });
          }
        }
      }

      // 2. Safety Net
      if (!isCurrentMonthSelected && stats.hours < 20) {
        generatedAlerts.push({
          type: 'critical',
          title: 'Sin Actividad Significativa',
          consultant: name,
          detail: 'Menos de 20hs registradas.',
          value: `${stats.hours.toFixed(0)}hs`,
          relatedIds: stats.allIds
        });
      }

      // 3. Weekend Work
      if (stats.weekendHours > 0) {
        generatedAlerts.push({
          type: 'info',
          title: 'Trabajo en Fin de Semana',
          consultant: name,
          detail: `Registró horas en sábado o domingo.`,
          value: `${stats.weekendHours.toFixed(0)}hs`,
          relatedIds: stats.weekendIds // Only weekend IDs
        });
      }

      // 4. Excessive Daily Load (> 12hs)
      const heavyDays = Object.entries(stats.days).filter(([_, h]) => h > 12);
      if (heavyDays.length > 0) {
        // Collect all IDs from all heavy days
        const heavyIds = heavyDays.flatMap(([date]) => stats.dayIds[date] || []);
        
        generatedAlerts.push({
          type: 'warning',
          title: 'Jornada Excesiva (>12hs)',
          consultant: name,
          detail: `Detectados ${heavyDays.length} días con más de 12 horas.`,
          value: `${heavyDays.length} días`,
          relatedIds: heavyIds // Only IDs from heavy days
        });
      }
    });

    return generatedAlerts.sort((a, b) => {
      const weight = { critical: 3, warning: 2, info: 1 };
      return weight[b.type] - weight[a.type];
    });

  }, [data, selectedMonths, isSingleMonth]);

  const stats = {
    critical: alerts.filter(a => a.type === 'critical').length,
    warning: alerts.filter(a => a.type === 'warning').length,
    info: alerts.filter(a => a.type === 'info').length,
  };

  if (data.length === 0) return null;

  return (
    <div className="bg-[#172e4d] rounded-xl border border-slate-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center bg-[#0f213a]">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-white">Tablero de Control y Alertas</h3>
        </div>
        <div className="flex gap-2">
          {stats.critical > 0 && <span className="px-2 py-1 rounded bg-red-900/50 text-red-200 text-xs border border-red-800 font-medium">{stats.critical} Críticas</span>}
          {stats.warning > 0 && <span className="px-2 py-1 rounded bg-amber-900/50 text-amber-200 text-xs border border-amber-800 font-medium">{stats.warning} Alertas</span>}
        </div>
      </div>
      
      {!isSingleMonth && alerts.length > 0 && (
        <div className="bg-blue-900/20 px-6 py-3 border-b border-blue-800/30 flex items-center gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-200">
            <strong>Nota:</strong> Selecciona un <strong>único mes</strong> para ver análisis de cumplimiento de objetivos.
          </p>
        </div>
      )}

      <div className="p-6">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
            <p className="font-medium text-white">¡Todo se ve bien!</p>
            <p className="text-sm">No se detectaron anomalías en las horas cargadas para el filtro actual.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alerts.map((alert, idx) => (
              <div 
                key={idx} 
                onClick={() => onFilterByIds(alert.relatedIds)}
                className={`
                  relative rounded-lg p-4 border flex flex-col gap-2 transition-all 
                  cursor-pointer hover:scale-[1.02] hover:shadow-lg group
                  ${alert.type === 'critical' ? 'bg-red-900/10 border-red-900/50 hover:bg-red-900/20' : ''}
                  ${alert.type === 'warning' ? 'bg-amber-900/10 border-amber-900/50 hover:bg-amber-900/20' : ''}
                  ${alert.type === 'info' ? 'bg-blue-900/10 border-blue-900/50 hover:bg-blue-900/20' : ''}
                `}
                title="Haz clic para ver los registros relacionados en la tabla"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {alert.type === 'critical' && <AlertOctagon className="w-5 h-5 text-red-400" />}
                    {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                    {alert.type === 'info' && <Clock className="w-5 h-5 text-blue-400" />}
                    <span className={`text-sm font-bold uppercase tracking-wider ${
                      alert.type === 'critical' ? 'text-red-400' : 
                      alert.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      {alert.type === 'critical' ? 'Atraso' : alert.type === 'warning' ? 'Atención' : 'Info'}
                    </span>
                  </div>
                  <span className="text-xs font-mono bg-[#0D2340] px-2 py-1 rounded text-slate-300 border border-slate-700">
                    {alert.value}
                  </span>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-0.5 group-hover:underline decoration-dotted underline-offset-4">{alert.consultant}</h4>
                  <p className={`text-xs font-medium mb-2 ${
                     alert.type === 'critical' ? 'text-red-200' : 
                     alert.type === 'warning' ? 'text-amber-200' : 'text-blue-200'
                  }`}>{alert.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{alert.detail}</p>
                </div>
                
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MousePointerClick className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};