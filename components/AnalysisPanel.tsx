import React, { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle, RefreshCcw } from 'lucide-react';
import { AIAnalysisResult } from '../types';

interface AnalysisPanelProps {
  analysis: AIAnalysisResult | null;
  loading: boolean;
  onAnalyze: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis, loading, onAnalyze }) => {
  if (!analysis && !loading) {
    return (
      <div className="bg-gradient-to-r from-indigo-900 to-blue-900 rounded-xl p-6 text-white shadow-lg border border-indigo-800 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            Análisis Inteligente
          </h3>
          <p className="text-indigo-200 mt-1 text-sm max-w-xl">
            Utiliza Gemini AI para analizar patrones de carga de trabajo, detectar riesgos de burnout y oportunidades de eficiencia.
          </p>
        </div>
        <button
          onClick={onAnalyze}
          className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generar Reporte
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#172e4d] rounded-xl p-8 shadow-sm border border-slate-700 flex flex-col items-center justify-center animate-pulse">
        <div className="w-12 h-12 border-4 border-indigo-900 border-t-indigo-400 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-300 font-medium">Gemini está analizando los datos de tu equipo...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#172e4d] rounded-xl shadow-sm border border-slate-700 overflow-hidden">
      <div className="bg-[#0f1f38] px-6 py-4 flex justify-between items-center border-b border-slate-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          Reporte Ejecutivo IA
        </h3>
        <button onClick={onAnalyze} className="text-slate-400 hover:text-white transition-colors p-1">
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 mb-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen Ejecutivo</h4>
          <p className="text-white text-lg leading-relaxed">{analysis?.summary}</p>
        </div>

        <div className="bg-amber-900/20 rounded-lg p-5 border border-amber-800/50">
          <h4 className="text-amber-400 font-bold flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" />
            Riesgos Detectados
          </h4>
          <ul className="space-y-2">
            {analysis?.risks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2 text-amber-100 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0"></span>
                {risk}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-emerald-900/20 rounded-lg p-5 border border-emerald-800/50 lg:col-span-2">
          <h4 className="text-emerald-400 font-bold flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5" />
            Recomendaciones Estratégicas
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis?.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-emerald-100 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0"></span>
                {rec}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};