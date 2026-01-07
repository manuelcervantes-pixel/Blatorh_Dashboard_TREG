import { GoogleGenAI, Type } from "@google/genai";
import { KPI, AggregatedData, AIAnalysisResult } from "../types";

const parseGeminiResponse = (text: string): AIAnalysisResult => {
  try {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse Gemini JSON response", e);
    return {
      summary: "No se pudo generar el análisis automático.",
      risks: [],
      recommendations: ["Verifique su clave API e intente nuevamente."]
    };
  }
};

export const analyzeWorkData = async (kpis: KPI, aggregated: AggregatedData): Promise<AIAnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Simplify data for the prompt to save tokens and ensure focus
  const summaryData = {
    total_hours: kpis.totalHours,
    active_consultants: kpis.totalConsultants,
    top_client: kpis.topClient,
    client_distribution: aggregated.byClient.slice(0, 5), // Top 5 clients
    consultant_load: aggregated.byConsultant.map(c => ({ name: c.name, hours: c.hours })),
  };

  const prompt = `
    Actúa como un experto Consultor de Gestión de Proyectos y Analista de Datos Senior.
    Analiza los siguientes datos de horas trabajadas de un equipo de consultoría:
    ${JSON.stringify(summaryData)}

    Proporciona un informe ejecutivo breve en formato JSON con la siguiente estructura exacta:
    {
      "summary": "Un párrafo resumen de la situación actual (max 40 palabras).",
      "risks": ["Lista de 2-3 riesgos potenciales (ej: sobrecarga de trabajo, dependencia de un cliente, baja productividad)."],
      "recommendations": ["Lista de 2-3 recomendaciones estratégicas para mejorar."]
    }
    
    Responde SOLAMENTE con el JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    return parseGeminiResponse(response.text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};