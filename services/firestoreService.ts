
import { getFirestore, collection, getDocs, writeBatch, doc, query, orderBy } from "firebase/firestore";
import { firebaseConfig, app } from "../firebaseConfig";
import { WorkLog } from "../types";

// Initialize Firebase only if config is valid-ish
let db: any = null;
try {
    if (firebaseConfig.apiKey !== "TU_API_KEY_AQUI") {
        db = getFirestore(app);
    }
} catch (e) {
    console.error("Firebase init error", e);
}

export const isFirebaseConfigured = () => {
    return db !== null && firebaseConfig.apiKey !== "TU_API_KEY_AQUI";
};

// --- DEDUPLICATION ID GENERATOR ---
// This ensures that if we upload the same CSV twice, it overwrites based on content
const generateDocId = (log: WorkLog): string => {
    // Unique fingerprint: Date + Consultant + Client + Ticket + Hours
    // We remove special chars to make it a valid ID
    const raw = `${log.date}-${log.consultant}-${log.client}-${log.ticketId || ''}-${log.hours}-${log.recordType || ''}`;
    return raw.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 100); 
};

export const fetchAllWorkLogs = async (): Promise<WorkLog[]> => {
    if (!db) throw new Error("Firebase no configurado");
    
    const q = query(collection(db, "workLogs")); // You can add orderBy("date", "desc") but might need an index
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as WorkLog[];
};

export const batchUploadWorkLogs = async (logs: WorkLog[], onProgress?: (count: number) => void): Promise<number> => {
    if (!db) throw new Error("Firebase no configurado");
    if (logs.length === 0) return 0;

    const collectionRef = collection(db, "workLogs");
    let batch = writeBatch(db);
    let count = 0;
    let totalUploaded = 0;
    const BATCH_SIZE = 450; // Firestore limit is 500

    for (const log of logs) {
        const docId = generateDocId(log);
        const docRef = doc(collectionRef, docId);
        
        // Clean undefined values before saving
        const cleanLog = Object.fromEntries(
            Object.entries(log).filter(([_, v]) => v !== undefined)
        );

        batch.set(docRef, cleanLog); // .set() overwrites existing ID (Deduplication!)
        count++;

        if (count >= BATCH_SIZE) {
            await batch.commit();
            totalUploaded += count;
            if (onProgress) onProgress(totalUploaded);
            batch = writeBatch(db); // Reset batch
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        totalUploaded += count;
    }

    return totalUploaded;
};