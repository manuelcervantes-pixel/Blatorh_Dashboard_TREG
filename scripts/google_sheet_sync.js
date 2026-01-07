
/*
 * ==========================================
 * SCRIPT: WORKFORCE AI - SYNC & IMPORT
 * ==========================================
 * 
 * INSTRUCCIONES:
 * 1. Pega este código en Extensiones > Apps Script.
 * 2. Configura abajo el ID de tu Carpeta de Google Drive donde guardas los CSVs.
 * 3. Configura tus credenciales de Firebase si vas a usar la sincronización a la App.
 */

const CONFIGURACION = {
  // --- CONFIGURACIÓN PARA IMPORTAR CSVs ---
  folderId: "PEGA_AQUI_EL_ID_DE_TU_CARPETA_DE_DRIVE", // El ID es la parte final de la URL de la carpeta
  
  // --- CONFIGURACIÓN PARA SINCRONIZAR CON APP (FIRESTORE) ---
  email: "peg_aqui_tu_client_email_del_json",
  key: "-----BEGIN PRIVATE KEY-----\nPEGA_AQUI_TU_CLAVE_PRIVADA_COMPLETA\n-----END PRIVATE KEY-----\n",
  projectId: "workforce-analytics-b4b47"
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 WorkForce AI')
    .addItem('📂 Importar CSVs desde Drive', 'importarCSVsDesdeDrive')
    .addSeparator()
    .addItem('☁️ Sincronizar con la App (Firestore)', 'sincronizarFirestore')
    .addToUi();
}

/*
 * ------------------------------------------------------------------
 * FUNCIÓN 1: IMPORTAR CSVs DESDE DRIVE (Solución al error de columnas)
 * ------------------------------------------------------------------
 */
function importarCSVsDesdeDrive() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 1. Validar Carpeta
  if (!CONFIGURACION.folderId || CONFIGURACION.folderId.includes("PEGA_AQUI")) {
    ui.alert("Falta configuración", "Por favor edita el script y pon el ID de tu carpeta de Google Drive en CONFIGURACION.folderId", ui.ButtonSet.OK);
    return;
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(CONFIGURACION.folderId);
  } catch (e) {
    ui.alert("Error de Carpeta", "No se encontró la carpeta con ID: " + CONFIGURACION.folderId, ui.ButtonSet.OK);
    return;
  }

  // 2. Obtener Huellas Digitales de lo que ya existe (Para no duplicar)
  // Usamos una combinación de Fecha+Consultor+Horas+Proyecto para identificar únicos
  const existingData = sheet.getDataRange().getValues();
  const existingSignatures = new Set();
  // Asumimos cabecera en fila 1
  if (existingData.length > 1) {
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      // Ajusta estos índices según tu hoja: [0]=Fecha, [10]=Consultor (ejemplo)
      // Generamos una firma simple de toda la fila para estar seguros
      const sig = row.join('|').toLowerCase().replace(/\s/g, ''); 
      existingSignatures.add(sig);
    }
  }

  const files = folder.getFilesByType(MimeType.CSV);
  const newRows = [];
  let filesProcessed = 0;

  // 3. Obtener ancho objetivo de la hoja para evitar el error "Data has 5 but range has 12"
  // Si la hoja está vacía, el ancho será el del CSV. Si tiene datos, forzamos el ancho de la hoja.
  const sheetLastColumn = sheet.getLastColumn(); 
  const targetColumnCount = sheetLastColumn > 0 ? sheetLastColumn : null; 

  while (files.hasNext()) {
    const file = files.next();
    const content = file.getBlob().getDataAsString();
    const rows = parseCSVCustom(content); // Usamos parser robusto
    
    if (rows.length < 2) continue; // Archivo vacío o solo cabecera

    // Detectar si la primera fila es cabecera y saltarla
    const startIdx = 1; 

    for (let i = startIdx; i < rows.length; i++) {
      let row = rows[i];
      
      // --- CORRECCIÓN DE ERROR DE COLUMNAS ---
      if (targetColumnCount) {
        if (row.length < targetColumnCount) {
          // Rellenar con vacíos si faltan columnas
          const padding = new Array(targetColumnCount - row.length).fill("");
          row = row.concat(padding);
        } else if (row.length > targetColumnCount) {
          // Cortar si sobran columnas
          row = row.slice(0, targetColumnCount);
        }
      }
      // ---------------------------------------

      // Verificar duplicado
      const sig = row.join('|').toLowerCase().replace(/\s/g, '');
      if (!existingSignatures.has(sig)) {
        newRows.push(row);
        existingSignatures.add(sig); // Añadir a set local para no duplicar dentro del mismo lote
      }
    }
    filesProcessed++;
  }

  // 4. Escribir en la hoja
  if (newRows.length > 0) {
    // getRange(filaInicio, colInicio, numFilas, numCols)
    // Usamos newRows[0].length para asegurar que el rango coincide exactamente con los datos
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    ui.alert("Importación Completada", `Se procesaron ${filesProcessed} archivos.\nSe agregaron ${newRows.length} registros nuevos.`, ui.ButtonSet.OK);
  } else {
    ui.alert("Sin Novedades", `Se leyeron ${filesProcessed} archivos pero no se encontraron registros nuevos (todos eran duplicados).`, ui.ButtonSet.OK);
  }
}

// Parser CSV manual para manejar mejor comillas y separadores mixtos
function parseCSVCustom(text) {
  const rows = text.split(/\r\n|\n|\r/).filter(r => r.trim().length > 0);
  if (rows.length === 0) return [];

  // Detectar separador en la primera línea
  const firstLine = rows[0];
  const separator = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  return rows.map(line => splitLine(line, separator));
}

function splitLine(text, separator) {
  const result = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuote && text[i+1] === '"') {
        current += '"';
        i++; 
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
}


/*
 * ------------------------------------------------------------------
 * FUNCIÓN 2: SINCRONIZAR CON FIRESTORE (Existente)
 * ------------------------------------------------------------------
 */
function sincronizarFirestore() {
  const ui = SpreadsheetApp.getUi();
  
  let firestore;
  try {
    firestore = FirestoreApp.getFirestore(CONFIGURACION.email, CONFIGURACION.key, CONFIGURACION.projectId);
  } catch (e) {
    ui.alert("Error de Configuración", "No se pudo conectar a Firebase. Revisa el email y la clave privada.\n\n" + e.message, ui.ButtonSet.OK);
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getDisplayValues(); 
  
  if (data.length < 2) {
    ui.alert("La hoja parece vacía.");
    return;
  }

  const headers = data[0].map(h => normalizeHeader(h));
  
  const map = {
    date: findIdx(headers, ['fecha', 'date']),
    client: findIdx(headers, ['cliente', 'customer'], true),
    hours: findIdx(headers, ['cantidaddehoras', 'horas', 'hours', 'tiempo']),
    recordType: findIdx(headers, ['tipoderegistro', 'tiporegistro', 'tipo']), 
    ticketId: findIdx(headers, ['idticketcliente', 'ticket', 'idticket'], true), 
    ticketIdInternal: findIdx(headers, ['idticketinterno', 'internalticket', 'idinterno']),
    project: findIdx(headers, ['tarea', 'actividad', 'project', 'task']),
    consultant: findIdx(headers, ['consultor', 'recurso', 'nombre', 'empleado'], true),
    description: findIdx(headers, ['observaciones', 'observacion', 'descripcion', 'comentarios']),
    consultantType: findIdx(headers, ['tipodeconsultor', 'tipoconsultor', 'modalidad', 'seniority'])
  };

  if (map.date === -1 || map.hours === -1 || map.consultant === -1) {
    ui.alert("Error de Columnas", "Faltan columnas obligatorias (Fecha, Horas, Consultor).", ui.ButtonSet.OK);
    return;
  }

  const logs = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[map.date] && !row[map.consultant]) continue;

    const hoursStr = row[map.hours] ? row[map.hours].replace(',', '.') : '0';
    const hours = parseFloat(hoursStr);
    
    if (isNaN(hours) || hours === 0) continue;

    const log = {
      date: formatDateForDB(row[map.date]),
      consultant: row[map.consultant] || 'Desconocido',
      client: (map.client > -1 ? row[map.client] : 'Desconocido') || 'Desconocido',
      hours: hours,
      project: map.project > -1 ? row[map.project] : '',
      description: map.description > -1 ? row[map.description] : '',
      ticketId: map.ticketId > -1 ? row[map.ticketId] : '',
      internalTicketId: map.ticketIdInternal > -1 ? row[map.ticketIdInternal] : '',
      recordType: map.recordType > -1 ? row[map.recordType] : '',
      consultantType: map.consultantType > -1 ? row[map.consultantType] : detectType(row)
    };
    
    logs.push({ id: generateFingerprint(log), data: log });
  }

  const BATCH_SIZE = 400;
  let totalUploaded = 0;
  sheet.getParent().toast(`Iniciando carga de ${logs.length} registros...`, "Sincronizando", 10);

  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const batch = logs.slice(i, i + BATCH_SIZE);
    batch.forEach(item => {
      firestore.createDocument("workLogs/" + item.id, item.data);
    });
    totalUploaded += batch.length;
    sheet.getParent().toast(`Procesados ${totalUploaded} de ${logs.length}...`, "Cargando", -1);
  }

  ui.alert("¡Éxito!", `Sincronizados ${totalUploaded} registros a la App.`, ui.ButtonSet.OK);
}

// --- UTILIDADES ---
function normalizeHeader(h) { return h ? h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s\-_./]/g, '') : ''; }
function findIdx(headers, keywords, exact = false) { return headers.findIndex(h => exact ? keywords.some(k => h === k) : keywords.some(k => h.includes(k))); }
function formatDateForDB(dateStr) {
  if (!dateStr) return '';
  let clean = dateStr.trim().split(' ')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return clean;
}
function detectType(row) {
  const text = row.join(' ').toLowerCase();
  if (text.includes('full time') || text.includes('fulltime')) return 'Full Time';
  if (text.includes('part time') || text.includes('parttime')) return 'Part Time';
  return 'No definido';
}
function generateFingerprint(log) {
  const raw = `${log.date}-${log.consultant}-${log.client}-${log.ticketId || ''}-${log.hours}-${log.recordType || ''}`;
  return raw.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 100);
}
