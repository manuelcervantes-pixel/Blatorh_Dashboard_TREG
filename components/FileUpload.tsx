import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle, Download, Link as LinkIcon, HelpCircle } from 'lucide-react';
import { WorkLog } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: WorkLog[], sourceUrl?: string) => void;
}

// Robust CSV Line Splitter that handles quotes correctly
const splitCSVLine = (text: string, separator: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuote && text[i+1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuote = !inQuote;
      }
    } else if (char === separator && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

// Normalize header strings for comparison
const normalizeHeader = (h: string) => h?.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s\-_./]/g, '') || '';

// --- CONFIG PARSER (Exported for App.tsx) ---
export const parseConfigCSV = (text: string): Record<string, string> => {
  const rows = text.split(/\r\n|\n|\r/).filter(r => r.trim().length > 0);
  if (rows.length < 1) return {};

  const config: Record<string, string> = {};
  const sample = rows.slice(0, 3).join('\n');
  const separator = (sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length ? ';' : ',';

  const firstRow = rows[0];
  const headers = splitCSVLine(firstRow, separator).map(normalizeHeader);

  const nameKeywords = ['consultor', 'nombre', 'recurso', 'empleado', 'persona', 'usuario', 'collaborador', 'name'];
  const typeKeywords = ['tipodeconsultor', 'tipoconsultor', 'modalidad', 'clasificacion', 'rol', 'perfil', 'seniority', 'categoria', 'status', 'type', 'tipo'];

  let nameIdx = headers.findIndex(h => nameKeywords.some(k => h.includes(k)));
  let typeIdx = headers.findIndex(h => typeKeywords.some(k => h.includes(k)));

  if (nameIdx === -1) nameIdx = 0;
  if (typeIdx === -1) typeIdx = 1;

  const startRow = 1;
  for (let i = startRow; i < rows.length; i++) {
    const cols = splitCSVLine(rows[i], separator);
    if (cols.length > Math.max(nameIdx, typeIdx)) {
      const name = cols[nameIdx]?.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
      const type = cols[typeIdx]?.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '').trim();
      if (name && type) {
        config[name] = type;
      }
    }
  }
  return config;
};

// --- MAIN DATA PARSER ---
export const parseCSVString = (text: string): WorkLog[] => {
  const rows = text.split(/\r\n|\n|\r/).filter(r => r.trim().length > 0);
  if (rows.length < 2) return [];

  const data: WorkLog[] = [];
  const seenRows = new Set<string>(); 
  
  const headerRowStr = rows[0];
  const commaSplit = splitCSVLine(headerRowStr, ',');
  const semicolonSplit = splitCSVLine(headerRowStr, ';');
  const separator = semicolonSplit.length >= commaSplit.length ? ';' : ',';
  
  const headerCols = splitCSVLine(headerRowStr, separator).map(normalizeHeader);
  const expectedColCount = headerCols.length;

  const findIdx = (keywords: string[], exact: boolean = false) => {
    return headerCols.findIndex(h => {
      if (exact) return keywords.some(k => h === k);
      return keywords.some(k => h.includes(k));
    });
  };

  const map = {
    date: findIdx(['fecha', 'date']),
    client: findIdx(['cliente', 'customer'], true),
    department: findIdx(['departamento', 'sector', 'area']),
    solicitante: findIdx(['solicitante']),
    hours: findIdx(['cantidaddehoras', 'horas', 'hours', 'tiempo']),
    recordType: findIdx(['tipoderegistro', 'tiporegistro', 'tipo']), 
    ticketId: findIdx(['idticketcliente', 'ticket', 'idticket'], true), 
    ticketIdInternal: findIdx(['idticketinterno', 'internalticket', 'idinterno']),
    project: findIdx(['tarea', 'actividad', 'project', 'task']),
    consultant: findIdx(['consultor', 'recurso', 'nombre', 'empleado'], true),
    description: findIdx(['observaciones', 'observacion', 'descripcion', 'comentarios']),
    consultantType: findIdx(['tipodeconsultor', 'tipoconsultor', 'modalidad', 'seniority', 'modalidadcontratacion'])
  };

  const getVal = (cols: string[], index: number, fallbackIndex: number) => {
    const i = index !== -1 ? index : fallbackIndex;
    if (i === -1) return ''; 
    return cols[i]?.trim().replace(/^"|"$/g, '') || ''; 
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return '';
    let clean = dateStr.trim();
    if (clean.includes(' ')) clean = clean.split(' ')[0];
    if (clean.includes('T')) clean = clean.split('T')[0];
    const separator = clean.includes('/') ? '/' : clean.includes('-') ? '-' : null;
    if (separator) {
      const parts = clean.split(separator);
      if (parts.length === 3) {
        const p0 = parseInt(parts[0]);
        const p1 = parseInt(parts[1]);
        const p2 = parseInt(parts[2]);
        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          const pad = (n: number) => n.toString().padStart(2, '0');
          if (p0 > 1000) return `${p0}-${pad(p1)}-${pad(p2)}`;
          if (p2 > 1000) return `${p2}-${pad(p1)}-${pad(p0)}`;
        }
      }
    }
    return clean; 
  };

  const fuzzyFingerprint = (val: string, truncateLength: number = 50) => {
    if (!val) return '';
    return val.toLowerCase()
      .replace(/Ã/g, "")
      .replace(//g, "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[aeiou]/g, "") 
      .replace(/[^a-z0-9]/g, "") 
      .slice(0, truncateLength); 
  };

  for (let i = 1; i < rows.length; i++) {
    const rowStr = rows[i].trim();
    if (!rowStr) continue;
    
    const cols = splitCSVLine(rowStr, separator);

    // --- LINE HEALER: Fix Split Decimals (0,5) ---
    if (cols.length > expectedColCount) {
       for (let k = 0; k < cols.length - 1; k++) {
         const partA = cols[k].trim();
         const partB = cols[k+1].trim();
         if (/^\d+$/.test(partA) && /^\d+$/.test(partB)) {
           const merged = `${partA}.${partB}`;
           cols.splice(k, 2, merged); 
           if (cols.length === expectedColCount) break;
           k--;
         }
       }
    }
    
    if (cols.length >= 2) { 
      const hoursString = getVal(cols, map.hours, 4).replace(',', '.');
      const hours = parseFloat(hoursString);
      let consultantType = getVal(cols, map.consultantType, -1);
      
      if (!consultantType || consultantType === '') {
        const rowLower = rowStr.toLowerCase();
        if (rowLower.includes('full time') || rowLower.includes('fulltime')) consultantType = 'Full Time';
        else if (rowLower.includes('part time') || rowLower.includes('parttime')) consultantType = 'Part Time';
        else consultantType = 'No definido';
      }

      const parsedDate = parseDate(getVal(cols, map.date, 0));
      const client = getVal(cols, map.client, 1) || 'Desconocido';
      const project = getVal(cols, map.project, 8) || 'Sin Tarea';
      const consultant = getVal(cols, map.consultant, 10) || 'Desconocido';
      const description = getVal(cols, map.description, 11);
      const ticketId = getVal(cols, map.ticketId, 7);
      const internalTicketId = getVal(cols, map.ticketIdInternal, 6);
      const recordType = getVal(cols, map.recordType, 5);

      const rowFingerprint = `
        ${parsedDate}|
        ${hours}|
        ${fuzzyFingerprint(consultant)}|
        ${fuzzyFingerprint(client)}|
        ${fuzzyFingerprint(recordType)}|
        ${fuzzyFingerprint(ticketId)}|
        ${fuzzyFingerprint(internalTicketId)}
      `.replace(/\s/g, ''); 
      
      if (seenRows.has(rowFingerprint)) continue;
      seenRows.add(rowFingerprint);

      data.push({
        id: `${i}-${Math.random().toString(36).substr(2, 9)}`,
        date: parsedDate,
        client: client,
        department: getVal(cols, map.department, 2),
        project: project,
        hours: isNaN(hours) ? 0 : hours,
        recordType: recordType,
        ticketId: ticketId, 
        internalTicketId: internalTicketId,
        consultant: consultant,
        description: description,
        consultantType: consultantType
      });
    }
  }
  return data;
};

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>('url');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const processFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
      setError("Por favor sube un archivo con extensión .csv");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const data = parseCSVString(text);
        if (data.length === 0) {
          setError("El archivo se leyó pero no se encontraron filas válidas.");
        } else {
          onDataLoaded(data);
        }
      } catch (err) {
        console.error(err);
        setError("Error inesperado al procesar el archivo.");
      }
    };
    reader.onerror = () => setError("Error de lectura del archivo.");
    reader.readAsText(file);
  };

  const handleUrlSubmit = async () => {
    const trimmedUrl = sheetUrl.trim();
    if (!trimmedUrl) return;
    setError(null);
    setIsLoadingUrl(true);

    try {
      if (!trimmedUrl.includes('output=csv')) {
         console.warn("La URL no parece tener ?output=csv.");
      }

      const response = await fetch(trimmedUrl);
      if (!response.ok) {
         throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const text = await response.text();
      
      if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('<html')) {
         throw new Error('LINK_IS_HTML');
      }

      const data = parseCSVString(text);
      
      if (data.length === 0) {
        setError("El archivo CSV está vacío o el formato no es reconocido.");
      } else {
        onDataLoaded(data, trimmedUrl);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'LINK_IS_HTML') {
        setError("El enlace no es un CSV directo. Verifica que sea 'Publicar en la web' > CSV.");
      } else if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError("Error de Acceso (CORS). Intenta 'Archivo > Guardar como Google Sheets' y publica esa nueva versión.");
      } else {
        setError(`Error al cargar: ${err.message}`);
      }
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (mode === 'upload' && e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 bg-[#0D2340]">
      <div className="text-center mb-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-white mb-4">WorkForce Analytics</h1>
        <p className="text-slate-300 mb-6">
          Analiza el rendimiento de tu equipo. Conecta tu Google Sheet o sube un archivo CSV.
        </p>
        
        <div className="flex items-center justify-center gap-4 mb-8">
          <button 
            onClick={() => setMode('url')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === 'url' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#172e4d] border-slate-600 text-slate-400 hover:text-white'}`}
          >
            Google Drive / Sheets
          </button>
          <button 
            onClick={() => setMode('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === 'upload' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#172e4d] border-slate-600 text-slate-400 hover:text-white'}`}
          >
            Subir CSV Local
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <div className="w-full max-w-xl bg-[#172e4d] p-8 rounded-2xl border border-slate-600 shadow-xl">
          <div className="flex items-center gap-3 mb-4 text-white">
            <div className="bg-green-600 p-2 rounded-lg">
              <LinkIcon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold">Conectar Google Sheet</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 ml-1 uppercase">Enlace CSV Publicado</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
                  className="flex-1 bg-[#0D2340] border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
                <button 
                  onClick={handleUrlSubmit}
                  disabled={isLoadingUrl || !sheetUrl}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {isLoadingUrl ? 'Cargando...' : 'Conectar'}
                </button>
              </div>
            </div>
            <div className="bg-[#0D2340] p-4 rounded-lg border border-slate-700 text-sm text-slate-300">
               <div className="flex gap-2 items-start">
                 <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                 <div className="space-y-2">
                   <p className="text-xs text-slate-400">
                     <strong>¿Tu archivo tiene decimales con coma (0,5)?</strong>
                   </p>
                   <p className="text-xs text-slate-500">
                     Recomendamos usar <strong>Punto y Coma (;)</strong> como separador. 
                     Si usas comas, el sistema intentará corregir automáticamente los números partidos.
                   </p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className={`
            w-full max-w-xl p-12 border-2 border-dashed rounded-2xl transition-all cursor-pointer
            flex flex-col items-center justify-center gap-4
            ${isDragging ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 hover:border-slate-500 bg-[#172e4d]'}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="bg-blue-500/20 p-4 rounded-full">
            <Upload className="w-8 h-8 text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-white">Arrastra tu archivo CSV aquí</p>
            <p className="text-xs text-slate-500 mt-2">Recomendado: Separado por punto y coma (;)</p>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv"
            onChange={(e) => e.target.files && processFile(e.target.files[0])}
          />
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-2 text-red-400 bg-red-900/20 px-4 py-3 rounded-lg border border-red-800 max-w-xl w-full">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm whitespace-pre-wrap">{error}</span>
        </div>
      )}
    </div>
  );
}