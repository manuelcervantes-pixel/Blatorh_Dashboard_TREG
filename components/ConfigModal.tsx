import React, { useState, useMemo, useEffect } from 'react';
import { X, Save, Users, Search, Link as LinkIcon, AlertCircle, Plus } from 'lucide-react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultants: string[];
  config: Record<string, string>;
  onSaveConfig: (newConfig: Record<string, string>) => void;
  configSheetUrl?: string;
  onSetConfigSheetUrl?: (url: string) => void;
  isLoading?: boolean; // New Prop
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  consultants, 
  config, 
  onSaveConfig,
  configSheetUrl,
  onSetConfigSheetUrl,
  isLoading = false
}) => {
  const [localConfig, setLocalConfig] = useState<Record<string, string>>(config);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSheetUrl, setTempSheetUrl] = useState('');
  const [newTypeInput, setNewTypeInput] = useState('');

  // Sync local state with parent state
  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  useEffect(() => {
    if (configSheetUrl) setTempSheetUrl(configSheetUrl);
  }, [configSheetUrl]);

  // Dynamic Types: Derived from the unique values present in the loaded configuration
  const dynamicTypes = useMemo(() => {
    const values = Object.values(localConfig) as string[];
    const types = new Set(values.filter(val => val && val.trim() !== ''));
    // Always convert to array and sort
    return Array.from(types).sort();
  }, [localConfig]);

  const handleTypeChange = (consultant: string, type: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [consultant]: type
    }));
  };

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  const filteredConsultants = useMemo(() => {
    return consultants.filter(c => c.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [consultants, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#172e4d] rounded-2xl shadow-2xl border border-slate-600 w-full max-w-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-600">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configuración de Equipo</h2>
              <p className="text-sm text-slate-400">
                Tipos detectados: {dynamicTypes.length > 0 ? dynamicTypes.join(', ') : 'Ninguno'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* Cloud Sync Section */}
          <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-800/50">
            <div className="flex items-start gap-3">
              <div className="bg-blue-600 p-1.5 rounded-lg flex-shrink-0 mt-1">
                 <LinkIcon className="w-4 h-4 text-white" />
              </div>
              <div className="w-full">
                <h3 className="text-sm font-bold text-white mb-1">Sincronización en la Nube (Google Sheet)</h3>
                <p className="text-xs text-slate-300 mb-3">
                  Pega el enlace CSV de tu hoja "Configuración" (Columnas: Consultor, Tipo). Los tipos de consultor se cargarán automáticamente desde ahí.
                </p>
                <div className="flex gap-2">
                   <input 
                     type="text" 
                     className="flex-1 bg-[#0D2340] border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                     placeholder="https://docs.google.com/.../pub?output=csv"
                     value={tempSheetUrl}
                     onChange={(e) => setTempSheetUrl(e.target.value)}
                   />
                   <button 
                     onClick={() => onSetConfigSheetUrl && onSetConfigSheetUrl(tempSheetUrl)}
                     disabled={isLoading}
                     className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-slate-400 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors min-w-[80px]"
                   >
                     {isLoading ? 'Cargando...' : 'Cargar'}
                   </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
             <div className="h-px bg-slate-700 flex-1"></div>
             <span className="text-xs text-slate-500 uppercase font-medium">Asignación Manual</span>
             <div className="h-px bg-slate-700 flex-1"></div>
          </div>

          {/* Search Bar & Manual Type Add */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar consultor..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0D2340] border border-slate-600 rounded-lg py-2 pl-10 pr-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            
             {/* Manual Add Input */}
             <div className="relative w-full sm:w-1/3">
                <input 
                  type="text" 
                  placeholder="Crear nuevo tipo..." 
                  value={newTypeInput}
                  onChange={(e) => setNewTypeInput(e.target.value)}
                  className="w-full bg-[#0D2340] border border-slate-600 rounded-lg py-2 pl-3 pr-10 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
                <button 
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  title="Para agregar, escribe y selecciona abajo"
                >
                  <Plus className="w-4 h-4" />
                </button>
             </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {filteredConsultants.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No se encontraron consultores.</p>
            ) : (
              filteredConsultants.map(consultant => (
                <div key={consultant} className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#0D2340] p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors gap-3">
                  <span className="font-medium text-slate-200 truncate pr-2">{consultant}</span>
                  
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {/* Combine existing dynamic types with the new input if typed */}
                    {[...dynamicTypes, ...(newTypeInput && !dynamicTypes.includes(newTypeInput) ? [newTypeInput] : [])].map(type => {
                      const isActive = localConfig[consultant] === type;
                      return (
                        <button
                          key={type}
                          onClick={() => handleTypeChange(consultant, type)}
                          className={`
                            px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-all border
                            ${isActive 
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' 
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'}
                          `}
                        >
                          {type}
                        </button>
                      );
                    })}
                    {dynamicTypes.length === 0 && !newTypeInput && (
                      <span className="text-xs text-slate-500 italic">Sin tipos cargados</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-600 bg-[#0f213a] rounded-b-2xl flex justify-between items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-amber-500">
             <AlertCircle className="w-4 h-4" />
             <span>Los cambios manuales anulan la Hoja.</span>
          </div>
          <div className="flex gap-3 ml-auto">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};