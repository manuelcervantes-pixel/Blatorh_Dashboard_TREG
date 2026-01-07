import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, Clock, Briefcase, TrendingUp, Search, 
  BarChart2, PieChart, Filter, X, Ticket, Calendar,
  ChevronDown, CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown,
  Upload, Image as ImageIcon, Save, Trash2, UserCheck, Link as LinkIcon, Share2, LogOut, Building2,
  Settings, UserCog, Award, BatteryLow, EyeOff, Download
} from 'lucide-react';
import { 
  ComposedChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart as RePieChart, Pie, Cell, Line, LabelList, Label
} from 'recharts';
import { FileUpload, parseConfigCSV, parseCSVString } from './components/FileUpload';
import { StatsCard } from './components/StatsCard';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ControlPanel } from './components/ControlPanel';
import { ConfigModal } from './components/ConfigModal';
import { WorkLog, AIAnalysisResult } from './types';
import { analyzeWorkData } from './services/geminiService';

const DEFAULT_CONFIG = {
  // CONFIGURACIÓN DEL EQUIPO (TIPOS DE CONSULTOR)
  CONFIG_SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRp24u9BeIaC2XDhHsn7SjhwotNgQR4wnu_Lp1qf2v-aVqdtdOnKYZWTnjHGBYryMAd3c4hd5qxJpNS/pub?gid=0&single=true&output=csv", 
  
  // LOGO PREDETERMINADO
  LOGO_URL: "https://lh3.googleusercontent.com/d/1PYr6M1H_SIAoPrhaxIbZCWyv4_mh6GX1",

  // PEGA AQUÍ EL LINK DE TU ARCHIVO MAESTRO DE HORAS (CSV PUBLICADO)
  DATA_LOGS_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTDmS7idjTxmnN40uBv71nhPuz4VlPdUVtnevdA-FslVb5Tc1-jdTvWiVHzpIkggLY_5sbL_M5j5dN3/pub?gid=0&single=true&output=csv" 
};

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee', '#60a5fa', '#fb7185', '#c084fc', '#2dd4bf'];

interface SelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: SelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const isAllSelected = selected.length === 0;

  return (
    <div className="relative min-w-[160px] flex-shrink-0" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full bg-[#172e4d] border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 shadow-sm hover:bg-[#1e3a60] transition-colors"
      >
        <span className="truncate">
          {selected.length === 0 
            ? `Todos: ${label}` 
            : `${selected.length} ${label}(s)`}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-[#172e4d] rounded-lg shadow-xl border border-slate-600 max-h-60 overflow-y-auto custom-scrollbar left-0">
          <div 
            className="px-3 py-2 border-b border-slate-600 hover:bg-slate-700 cursor-pointer flex items-center gap-2"
            onClick={() => onChange([])}
          >
            {isAllSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-400" />}
            <span className="text-sm font-medium text-slate-200">Seleccionar Todos</span>
          </div>
          {options.map(option => {
            const isSelected = selected.includes(option.value);
            return (
              <div 
                key={option.value} 
                className="px-3 py-2 hover:bg-slate-700 cursor-pointer flex items-center gap-2"
                onClick={() => toggleOption(option.value)}
              >
                {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-400" />}
                <span className="text-sm text-slate-300 truncate" title={option.label}>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


const App: React.FC = () => {
  const [rawData, setRawData] = useState<WorkLog[]>([]); 
  const [filteredData, setFilteredData] = useState<WorkLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof WorkLog; direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null); 

  // --- CONFIG STATE ---
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configSheetUrl, setConfigSheetUrl] = useState<string>('');
  const [isConfigLoading, setIsConfigLoading] = useState(false); 
  const [consultantConfig, setConsultantConfig] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('consultantConfig');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [forcedFilterIds, setForcedFilterIds] = useState<string[] | null>(null);

  useEffect(() => {
    localStorage.setItem('consultantConfig', JSON.stringify(consultantConfig));
  }, [consultantConfig]);
  useEffect(() => {
    if (configSheetUrl) localStorage.setItem('configSheetUrl', configSheetUrl);
  }, [configSheetUrl]);

  const [selectedClients, setSelectedClients] = useState<string[]>([]); 
  const [selectedConsultants, setSelectedConsultants] = useState<string[]>([]); 
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedRecordTypes, setSelectedRecordTypes] = useState<string[]>([]);
  const [selectedConsultantTypes, setSelectedConsultantTypes] = useState<string[]>([]); 

  // --- LOGO LOGIC ---
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem('appLogo') || DEFAULT_CONFIG.LOGO_URL || null;
  });
  const [imgError, setImgError] = useState(false);

  // --- INITIAL DATA LOAD ---
  useEffect(() => {
    const initData = async () => {
      const localConfigUrl = localStorage.getItem('configSheetUrl') || DEFAULT_CONFIG.CONFIG_SHEET_URL;
      if (localConfigUrl) {
        setConfigSheetUrl(localConfigUrl);
        fetch(localConfigUrl).then(res => res.text()).then(txt => {
           if (!txt.trim().startsWith('<!DOCTYPE')) {
               const conf = parseConfigCSV(txt);
               if (Object.keys(conf).length > 0) setConsultantConfig(prev => ({...prev, ...conf}));
           }
        }).catch(err => console.warn("Team Config Load Error", err));
      }

      const savedDataUrl = localStorage.getItem('lastDataLogsUrl') || (DEFAULT_CONFIG.DATA_LOGS_URL !== "TU_LINK_DE_GOOGLE_SHEETS_AQUI" ? DEFAULT_CONFIG.DATA_LOGS_URL : null);
      
      if (savedDataUrl) {
        setIsInitialLoading(true);
        try {
          const response = await fetch(savedDataUrl);
          if (response.ok) {
            const text = await response.text();
            if (!text.trim().startsWith('<!DOCTYPE')) {
              const data = parseCSVString(text);
              if (data.length > 0) {
                setRawData(data);
              }
            }
          }
        } catch (e) {
          console.warn("Auto-load Data Error", e);
        } finally {
          setIsInitialLoading(false);
        }
      }
    };
    initData();
  }, []);

  const handleDataLoaded = (data: WorkLog[], sourceUrl?: string) => {
    setRawData(data);
    if (sourceUrl) {
      localStorage.setItem('lastDataLogsUrl', sourceUrl);
    }
  };

  // --- APPLY CONFIG TO DATA ---
  const data = useMemo(() => {
    return rawData
      .map(item => {
        if (consultantConfig[item.consultant]) {
          return { ...item, consultantType: consultantConfig[item.consultant] };
        }
        return item;
      })
      .filter(item => item.consultantType !== 'Externo' && item.consultantType !== 'SSFF');
  }, [rawData, consultantConfig]);

  const uniqueConsultantNames = useMemo(() => {
    return Array.from(new Set(rawData.map(d => d.consultant))).sort();
  }, [rawData]);

  const saveConsultantConfig = (newConfig: Record<string, string>) => {
    setConsultantConfig(newConfig);
  };

  const loadConfigSheet = async (url: string) => {
    if (!url) return;
    setIsConfigLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const text = await response.text();
      if (text.includes('<html')) {
        alert("Enlace incorrecto. Usa CSV publicado.");
        return;
      }
      const remoteConfig = parseConfigCSV(text);
      if (Object.keys(remoteConfig).length > 0) {
        setConsultantConfig(prev => ({ ...prev, ...remoteConfig }));
        setConfigSheetUrl(url);
        localStorage.setItem('configSheetUrl', url);
        alert(`Configuración actualizada.`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsConfigLoading(false);
    }
  };


  const clients = useMemo(() => {
    const unique = Array.from(new Set(data.map(d => d.client))).sort();
    return unique.map(c => ({ value: c, label: c }));
  }, [data]);

  const consultants = useMemo(() => {
    const unique = Array.from(new Set(data.map(d => d.consultant))).sort();
    return unique.map(c => ({ value: c, label: c }));
  }, [data]);

  const recordTypes = useMemo(() => {
    const unique = Array.from(new Set(data.map(d => d.recordType || 'N/A'))).sort();
    return unique.map(t => ({ value: t, label: t }));
  }, [data]);

  const consultantTypes = useMemo(() => {
    const unique = Array.from(new Set(data.map(d => d.consultantType || 'No definido'))).sort();
    return unique.map(t => ({ value: t, label: t }));
  }, [data]);
  
  const formatMonthLabel = (monthStr: string) => {
    const cleanStr = monthStr.endsWith('-') ? monthStr.slice(0, -1) : monthStr;
    const parts = cleanStr.split('-');
    if (parts.length < 2) return monthStr;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (isNaN(year) || isNaN(month)) return monthStr;
    const date = new Date(year, month - 1);
    if (isNaN(date.getTime())) return monthStr;
    return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  };

  const availableMonths = useMemo(() => {
    const months = new Set(data.map(d => d.date.substring(0, 7)));
    return (Array.from(months) as string[]).sort().reverse().map(m => ({ value: m, label: formatMonthLabel(m) }));
  }, [data]);


  useEffect(() => {
    let result = [...data];
    if (forcedFilterIds) {
      result = result.filter(d => forcedFilterIds.includes(d.id));
    } else {
      if (selectedMonths.length > 0) result = result.filter(d => selectedMonths.includes(d.date.substring(0, 7)));
      if (selectedClients.length > 0) result = result.filter(d => selectedClients.includes(d.client));
      if (selectedConsultants.length > 0) result = result.filter(d => selectedConsultants.includes(d.consultant));
      if (selectedRecordTypes.length > 0) result = result.filter(d => selectedRecordTypes.includes(d.recordType || 'N/A'));
      
      // --- LÓGICA INTELIGENTE DE "BAJA" ---
      if (selectedConsultantTypes.length > 0) {
        // Si el usuario seleccionó tipos específicos, filtramos solo por esos (si incluye "Baja", se verá)
        result = result.filter(d => selectedConsultantTypes.includes(d.consultantType || 'No definido'));
      } else {
        // Si no hay filtro seleccionado (Estado: "Todos"), OCULTAMOS "Baja" por defecto
        result = result.filter(d => (d.consultantType || '').toLowerCase() !== 'baja');
      }
    }
    
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(d => 
        d.project.toLowerCase().includes(lowerTerm) || 
        d.description.toLowerCase().includes(lowerTerm) ||
        (d.ticketId && d.ticketId.toLowerCase().includes(lowerTerm)) ||
        (d.internalTicketId && d.internalTicketId.toLowerCase().includes(lowerTerm))
      );
    }

    Object.keys(columnFilters).forEach(key => {
      const filterValue = columnFilters[key].toLowerCase();
      if (filterValue) {
        result = result.filter(item => {
          const val = item[key as keyof WorkLog];
          return String(val ?? '').toLowerCase().includes(filterValue);
        });
      }
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (typeof valA === 'number' && typeof valB === 'number') {
           return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA ?? '').toLowerCase();
        const strB = String(valB ?? '').toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setFilteredData(result);
  }, [data, selectedClients, selectedConsultants, selectedMonths, selectedRecordTypes, selectedConsultantTypes, searchTerm, columnFilters, sortConfig, forcedFilterIds]);

  const handleSort = (key: keyof WorkLog) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleAlertFilter = (ids: string[]) => {
    setForcedFilterIds(ids);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const clearAlertFilter = () => {
    setForcedFilterIds(null);
  };

  const handleMonthClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const clickedMonth = data.activePayload[0].payload.date;
      if (selectedMonths.length === 1 && selectedMonths[0] === clickedMonth) {
        setSelectedMonths([]);
      } else {
        setSelectedMonths([clickedMonth]);
      }
      if (selectedMonths.length !== 1 || selectedMonths[0] !== clickedMonth) {
         setTimeout(() => {
          tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ["Fecha", "Consultor", "Tipo Registro", "Cliente", "Ticket Cliente", "Ticket Interno", "Tarea", "Descripción", "Horas", "Tipo Consultor"];
    const q = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = filteredData.map(row => [
        row.date, row.consultant, row.recordType, row.client, row.ticketId, row.internalTicketId, row.project, row.description, row.hours.toString().replace('.', ','), row.consultantType
      ].map(q).join(';'));
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte_horas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Imagen demasiado grande (Max 2MB).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        try {
          localStorage.setItem('appLogo', result);
          setLogoUrl(result);
          setImgError(false);
        } catch (e) {
          alert("Error de almacenamiento local. Imagen muy pesada.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Volver al logo predeterminado?")) {
      localStorage.removeItem('appLogo');
      setLogoUrl(DEFAULT_CONFIG.LOGO_URL || null);
      setImgError(false);
    }
  };

  const stats = useMemo(() => {
    const totalHours = filteredData.reduce((acc, curr) => acc + curr.hours, 0);
    const uniqueConsultants = new Set(filteredData.map(d => d.consultant)).size;
    const uniqueClients = new Set(filteredData.map(d => d.client)).size;
    
    const clientHours: Record<string, number> = {};
    filteredData.forEach((d: WorkLog) => {
      clientHours[d.client] = (clientHours[d.client] || 0) + d.hours;
    });
    
    const sortedClients = Object.entries(clientHours).sort(([, hoursA], [, hoursB]) => (hoursB as number) - (hoursA as number));
    const topClient = sortedClients[0]?.[0] || 'N/A';
    const topClientHours = sortedClients[0]?.[1] || 0;

    const consultantPivotRaw: Record<string, any> = {};
    const activeClientsInView: string[] = (Array.from(new Set(filteredData.map((d: WorkLog) => d.client))) as string[]).sort();

    filteredData.forEach((d: WorkLog) => {
      if (!consultantPivotRaw[d.consultant]) {
        consultantPivotRaw[d.consultant] = { name: d.consultant, total: 0 };
        activeClientsInView.forEach((c: string) => {
            consultantPivotRaw[d.consultant][c] = 0;
        });
      }
      consultantPivotRaw[d.consultant][d.client] = (consultantPivotRaw[d.consultant][d.client] || 0) + d.hours;
      consultantPivotRaw[d.consultant].total += d.hours;
    });

    const consultantStackedData = Object.values(consultantPivotRaw).sort((a: any, b: any) => b.total - a.total); 
    const topConsultantObj = consultantStackedData.length > 0 ? consultantStackedData[0] : { name: 'N/A', total: 0 };
    const bottomConsultantObj = consultantStackedData.length > 0 ? consultantStackedData[consultantStackedData.length - 1] : { name: 'N/A', total: 0 };

    const monthlyTrendRaw: Record<string, any> = {};
    filteredData.forEach(d => {
      const monthKey = d.date.substring(0, 7);
      if (!monthlyTrendRaw[monthKey]) monthlyTrendRaw[monthKey] = { date: monthKey, hours: 0 };
      monthlyTrendRaw[monthKey].hours += d.hours;
      const typeKey = d.recordType || 'Sin Tipo';
      monthlyTrendRaw[monthKey][typeKey] = (monthlyTrendRaw[monthKey][typeKey] || 0) + d.hours;
    });

    const monthlyTrendData = Object.values(monthlyTrendRaw).sort((a: any, b: any) => a.date.localeCompare(b.date));

    return {
      kpi: { 
        totalHours, totalConsultants: uniqueConsultants, totalClients: uniqueClients, topClient, topClientHours,
        avgDailyHours: 0, topConsultantName: topConsultantObj.name, topConsultantHours: topConsultantObj.total,
        bottomConsultantName: bottomConsultantObj.name, bottomConsultantHours: bottomConsultantObj.total,
      },
      charts: { byClient: sortedClients.map(([name, value]) => ({ name, value })), consultantStacked: consultantStackedData, activeClientsKeys: activeClientsInView, monthlyTrend: monthlyTrendData }
    };
  }, [filteredData]);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const consultantSimple = stats.charts.consultantStacked.map((c: any) => ({ name: c.name, hours: c.total }));
      await analyzeWorkData(stats.kpi, { byClient: stats.charts.byClient, byConsultant: consultantSimple, byDate: stats.charts.monthlyTrend }).then(res => setAiAnalysis(res));
    } catch (error) {
      alert("Error generating AI analysis.");
    } finally {
      setAiLoading(false);
    }
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  const CustomMonthTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#1e293b] border border-slate-600 p-3 rounded-lg shadow-xl text-xs z-50">
          <p className="font-bold text-white mb-2 pb-1 border-b border-slate-700">{formatMonthLabel(label)}</p>
          <div className="flex justify-between gap-4 mb-2">
            <span className="text-slate-300">Total:</span>
            <span className="text-blue-400 font-bold">{data.hours.toFixed(1)} hs</span>
          </div>
          <div className="space-y-1">
             {Object.keys(data).map(key => {
               if (key !== 'date' && key !== 'hours') return <div key={key} className="flex justify-between gap-4 text-[10px] text-slate-400"><span>{key}:</span><span>{data[key].toFixed(1)}</span></div>;
               return null;
             })}
          </div>
          <p className="mt-2 text-[9px] text-slate-500 italic">Clic para filtrar este mes</p>
        </div>
      );
    }
    return null;
  };

  const consultantChartHeight = Math.max(400, stats.charts.consultantStacked.length * 50);

  // --- MAIN APP ---
  const SortableHeader = ({ label, sortKey, width }: { label: string, sortKey: keyof WorkLog, width?: string }) => (
    <th className={`px-4 py-3 align-top ${width}`}>
      <div className="flex items-center gap-1 cursor-pointer hover:text-indigo-400 mb-2 select-none text-slate-200" onClick={() => handleSort(sortKey)}>
        <span>{label}</span>
        <div className="flex flex-col">
          {sortConfig?.key === sortKey ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />) : (<ArrowUpDown className="w-3 h-3 text-slate-500" />)}
        </div>
      </div>
      <input type="text" placeholder={`Filtrar...`} className="w-full px-2 py-1 text-xs border border-slate-600 bg-[#0D2340] text-white rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-normal placeholder-slate-500" value={columnFilters[sortKey] || ''} onChange={(e) => handleColumnFilterChange(sortKey, e.target.value)} onClick={(e) => e.stopPropagation()} />
    </th>
  );

  return (
    <div className="min-h-screen pb-12 bg-[#0D2340]">
      <ConfigModal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} consultants={uniqueConsultantNames} config={consultantConfig} onSaveConfig={saveConsultantConfig} configSheetUrl={configSheetUrl} onSetConfigSheetUrl={loadConfigSheet} isLoading={isConfigLoading} />

      <header className="bg-[#0D2340] border-b border-slate-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="bg-white p-1 rounded relative group cursor-pointer overflow-hidden border border-slate-500 h-12 w-32 flex items-center justify-center hover:border-blue-400 transition-colors" onClick={() => document.getElementById('logoInput')?.click()}>
                  <input type="file" id="logoInput" className="hidden" accept="image/png, image/jpeg" onChange={handleLogoSelect} />
                  {(logoUrl && !imgError) ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" onError={() => setImgError(true)} /> : <div className="flex flex-col items-center justify-center text-slate-400"><ImageIcon className="w-4 h-4" /><span className="text-[9px] font-medium text-slate-600 mt-1">SUBIR LOGO</span></div>}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Upload className="w-4 h-4 text-white" /></div>
               </div>
               {logoUrl && <button onClick={deleteLogo} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
             </div>

            <div className="h-8 w-px bg-slate-600 hidden sm:block"></div>
            <div>
              <div className="flex items-center gap-2">
                 <h1 className="text-xl font-bold text-white tracking-tight">Analytics Dashboard</h1>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button onClick={() => setIsConfigModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-[#1e3a60] hover:bg-[#253f66] text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-600 shadow-sm"><UserCog className="w-4 h-4 text-indigo-400" /><span className="hidden sm:inline">Equipo</span></button>
             
             {rawData.length > 0 && (
               <button 
                 onClick={() => {
                   setRawData([]);
                   localStorage.removeItem('lastDataLogsUrl');
                 }}
                 className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-xs font-medium rounded-lg transition-colors"
               >
                 <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Cerrar Archivo</span>
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {isInitialLoading ? (
           <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-300">
             <div className="w-12 h-12 border-4 border-indigo-900 border-t-indigo-400 rounded-full animate-spin mb-4"></div>
             <p className="font-medium">Cargando datos maestros automáticamente...</p>
           </div>
        ) : rawData.length === 0 ? (
           <FileUpload onDataLoaded={handleDataLoaded} />
        ) : (
          <>
            <div className="bg-[#172e4d] p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between sticky top-20 z-20">
              <div className="flex items-center gap-2 w-full xl:w-auto text-slate-300 border-b xl:border-b-0 pb-2 xl:pb-0 border-slate-700 justify-start">
                <Filter className="w-5 h-5" />
                <span className="font-medium text-sm">Filtros Globales:</span>
              </div>
              <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-center xl:justify-end items-center">
                {forcedFilterIds ? (
                  <div className="bg-amber-900/20 text-amber-200 px-4 py-2 rounded-lg border border-amber-800/50 flex items-center gap-3 w-full xl:w-auto animate-pulse">
                    <div className="flex items-center gap-2"><EyeOff className="w-4 h-4" /><span className="font-bold text-sm">Viendo registros de Alerta</span></div>
                    <button onClick={clearAlertFilter} className="bg-amber-800 hover:bg-amber-700 text-white text-xs px-2 py-1 rounded transition-colors">Mostrar Todo</button>
                  </div>
                ) : (
                  <>
                    <MultiSelect label="Meses" options={availableMonths} selected={selectedMonths} onChange={setSelectedMonths} />
                    <div className="h-8 w-px bg-slate-600 hidden md:block"></div>
                    <MultiSelect label="Tipo Registro" options={recordTypes} selected={selectedRecordTypes} onChange={setSelectedRecordTypes} />
                    <MultiSelect label="Tipo Consultor" options={consultantTypes} selected={selectedConsultantTypes} onChange={setSelectedConsultantTypes} />
                    <MultiSelect label="Cliente" options={clients} selected={selectedClients} onChange={setSelectedClients} />
                    <MultiSelect label="Consultor" options={consultants} selected={selectedConsultants} onChange={setSelectedConsultants} />
                  </>
                )}
                <div className="relative flex-grow min-w-[200px]">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Search className="w-4 h-4 text-slate-400" /></div>
                  <input type="text" className="bg-[#0D2340] border border-slate-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 placeholder-slate-400" placeholder="Buscar global..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              <StatsCard title="Total Horas" value={stats.kpi.totalHours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} icon={Clock} colorClass="bg-blue-500" />
              <StatsCard title="Consultor Top" value={stats.kpi.topConsultantName || 'N/A'} icon={Award} colorClass="bg-pink-500" trend={`${stats.kpi.topConsultantHours?.toFixed(1)} hs`} />
              <StatsCard title="Consultores Activos" value={stats.kpi.totalConsultants} icon={Users} colorClass="bg-purple-500" />
              <StatsCard title="Clientes" value={stats.kpi.totalClients} icon={Briefcase} colorClass="bg-emerald-500" />
              <StatsCard title="Cliente Principal" value={stats.kpi.topClient} icon={TrendingUp} colorClass="bg-amber-500" trend={`${stats.kpi.topClientHours?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} hs`} />
              <StatsCard title="Menor Carga" value={stats.kpi.bottomConsultantName || 'N/A'} icon={ArrowDown} colorClass="bg-slate-600" trend={`${stats.kpi.bottomConsultantHours?.toFixed(1)} hs`} />
            </div>

            <ControlPanel data={filteredData} selectedMonths={selectedMonths} onFilterByIds={handleAlertFilter} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#172e4d] p-6 rounded-xl border border-slate-700 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                  <div><h3 className="text-lg font-bold text-white flex items-center gap-2"><BarChart2 className="w-5 h-5 text-indigo-400" /> Horas Totales por Consultor y Cliente</h3></div>
                </div>
                <div style={{ height: `${consultantChartHeight}px`, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart layout="vertical" data={stats.charts.consultantStacked} margin={{ top: 20, right: 50, left: 100, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                      <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#cbd5e1' }} />
                      <YAxis type="category" dataKey="name" width={90} tick={{fontSize: 12, fill: '#e2e8f0'}} stroke="#94a3b8" interval={0} />
                      <RechartsTooltip cursor={{fill: '#1e3a60'}} contentStyle={{ borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff' }} />
                      <Legend verticalAlign="top" wrapperStyle={{paddingBottom: '20px', color: '#cbd5e1'}} />
                      {stats.charts.activeClientsKeys.map((clientKey, index) => (<Bar key={clientKey} dataKey={clientKey} stackId="a" fill={COLORS[index % COLORS.length]} barSize={30} />))}
                      <Line type="monotone" dataKey="total" stroke="none" isAnimationActive={false}><LabelList dataKey="total" position="right" style={{ fontWeight: 'bold', fill: '#cbd5e1', fontSize: '12px' }} formatter={(val: number) => val % 1 === 0 ? val : val.toFixed(1)} /></Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#172e4d] p-6 rounded-xl border border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><PieChart className="w-5 h-5 text-emerald-400" /> Distribución de Horas (%)</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={stats.charts.byClient} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={2} dataKey="value">
                        {stats.charts.byClient.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => `${value} hs`} contentStyle={{ borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px', maxHeight: '300px', overflowY: 'auto', color: '#cbd5e1'}}/>
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#172e4d] p-6 rounded-xl border border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-400" /> Evolución Mensual</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.charts.monthlyTrend} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="date" tick={{fontSize: 12, fill: '#cbd5e1'}} stroke="#94a3b8" tickFormatter={(val) => { const [y, m] = val.split('-'); return `${m}/${y}`; }} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#cbd5e1' }}><Label value="Total Horas" angle={-90} position="insideLeft" style={{textAnchor: 'middle', fill: '#94a3b8', fontSize: 12}} /></YAxis>
                      <RechartsTooltip cursor={{fill: '#1e3a60', cursor: 'pointer'}} content={<CustomMonthTooltip />} />
                      <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} onClick={handleMonthClick} cursor="pointer">
                        <LabelList dataKey="hours" position="top" formatter={(val: number) => val.toFixed(1)} style={{ fontSize: '12px', fill: '#cbd5e1', fontWeight: 'bold' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <AnalysisPanel analysis={aiAnalysis} loading={aiLoading} onAnalyze={handleAIAnalysis} />

            <div className="bg-[#172e4d] rounded-xl border border-slate-700 shadow-sm overflow-hidden" ref={tableRef}>
              <div className="px-6 py-4 border-b border-slate-700 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3"><h3 className="text-lg font-bold text-white">Detalle de Registros</h3><span className="text-xs font-medium text-slate-300 bg-slate-700 px-2 py-1 rounded">{filteredData.length} registros encontrados</span></div>
                <button onClick={handleExportCSV} disabled={filteredData.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors shadow-sm"><Download className="w-3.5 h-3.5" /><span>Exportar Registros</span></button>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs text-slate-200 uppercase bg-[#0f213a] sticky top-0 shadow-sm z-10">
                    <tr><SortableHeader label="Fecha" sortKey="date" /><SortableHeader label="Consultor" sortKey="consultant" /><SortableHeader label="Tipo Registro" sortKey="recordType" /><SortableHeader label="Cliente" sortKey="client" /><SortableHeader label="Ticket / Ref" sortKey="ticketId" /><SortableHeader label="Tarea" sortKey="project" /><SortableHeader label="Horas" sortKey="hours" width="w-24 text-right" /></tr>
                  </thead>
                  <tbody>
                    {filteredData.slice(0, 50).map((row) => (
                      <tr key={row.id} className="bg-[#172e4d] border-b border-slate-700 hover:bg-[#253f66] transition-colors">
                        <td className="px-4 py-3 font-medium text-white whitespace-nowrap align-middle">{row.date}</td>
                        <td className="px-4 py-3 align-middle">{row.consultant}</td>
                        <td className="px-4 py-3 align-middle"><span className={`text-xs font-medium px-2 py-0.5 rounded border ${row.recordType?.toLowerCase().includes('proyecto') ? 'bg-purple-900/50 text-purple-200 border-purple-800' : row.recordType?.toLowerCase().includes('mantenimiento') ? 'bg-teal-900/50 text-teal-200 border-teal-800' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>{row.recordType || 'N/A'}</span></td>
                        <td className="px-4 py-3 align-middle"><span className="bg-indigo-900/50 text-indigo-200 text-xs font-medium px-2.5 py-0.5 rounded border border-indigo-800">{row.client}</span></td>
                        <td className="px-4 py-3 text-slate-400 align-middle"><div className="flex items-center gap-1">{(row.ticketId || row.internalTicketId) && <Ticket className="w-3 h-3 flex-shrink-0" />}<span className="truncate max-w-[120px]" title={row.recordType?.toLowerCase().includes('proyecto') ? (row.internalTicketId || row.ticketId) : (row.ticketId || row.internalTicketId)}>{row.recordType?.toLowerCase().includes('proyecto') ? (row.internalTicketId || row.ticketId || '-') : (row.ticketId || row.internalTicketId || '-')}</span></div></td>
                        <td className="px-4 py-3 truncate max-w-xs align-middle" title={row.description}><div className="font-medium text-white truncate">{row.project}</div><div className="text-xs text-slate-500 truncate">{row.description}</div></td>
                        <td className="px-4 py-3 text-right font-bold text-white align-middle">{row.hours}</td>
                      </tr>
                    ))}
                    {filteredData.length > 50 && (<tr><td colSpan={7} className="px-6 py-4 text-center text-slate-400 italic">Mostrando los primeros 50 de {filteredData.length} registros...</td></tr>)}
                    {filteredData.length === 0 && (<tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 flex flex-col items-center justify-center"><Search className="w-8 h-8 text-slate-500 mb-2" /><p>No se encontraron registros con los filtros actuales.</p></td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;