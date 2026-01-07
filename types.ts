export interface WorkLog {
  id: string;
  date: string;
  consultant: string;
  client: string;
  project: string; // Mapped from "Tarea/Actividad"
  hours: number;
  description: string; // Mapped from "Observaciones"
  // New fields specific to the user's format
  ticketId?: string; // Mapped from "ID Ticket Cliente"
  internalTicketId?: string; // Mapped from "ID Ticket Interno"
  recordType?: string; // Mapped from "Tipo de Registro"
  department?: string; // Mapped from "Departamento/Sector"
  consultantType?: string; // New field: "Tipo de Consultor" (Full Time / Part Time)
}

export interface KPI {
  totalHours: number;
  totalConsultants: number;
  totalClients: number;
  topClient: string;
  topClientHours?: number; // Added
  avgDailyHours: number;
  topConsultantName?: string;
  topConsultantHours?: number;
  bottomConsultantName?: string; // Added
  bottomConsultantHours?: number; // Added
}

export interface AggregatedData {
  byClient: { name: string; value: number }[];
  byConsultant: { name: string; hours: number }[];
  byDate: { date: string; hours: number }[];
}

export interface AIAnalysisResult {
  summary: string;
  risks: string[];
  recommendations: string[];
}