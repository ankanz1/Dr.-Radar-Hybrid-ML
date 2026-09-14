import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initialization of GoogleGenAI client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Medical Assistant API Route
app.post("/api/assistant/chat", async (req, res) => {
  try {
    const { message, role, context, history } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.status(503).json({
        error: "GEMINI_API_KEY not configured on server",
        fallback: true,
      });
    }

    const userRole = role || "patient";
    const contextPrompt = context
      ? `\nCURRENT DR. RADAR ACTIVE CONTEXT:\n- Type: ${context.type || "health record"}\n- Title: ${context.title || "Biomedical telemetry"}\n- Sample ID: ${context.sampleId || "N/A"}\n- Patient Name: ${context.patientName || "Ashton"}\n- Prediction: ${context.prediction || "N/A"}\n- Confidence: ${context.confidence || "N/A"}\n- Heart Rate: ${context.heartRate ? context.heartRate + " BPM" : "N/A"}\n- AAMI Code: ${context.aamiClass || "N/A"}\n- Intervals: PR=${context.intervals?.prMs || "N/A"}ms, QRS=${context.intervals?.qrsMs || "N/A"}ms\n- Clinical Findings: ${context.findings || context.clinicalNotes || "N/A"}\n`
      : "\nNo specific test context attached. User is asking a general health/platform question.\n";

    const systemInstruction = `You are Dr. Radar AI — the integrated healthcare intelligence assistant for Dr. Radar: Hybrid Quantum–Classical Healthcare Intelligence.

CRITICAL SAFETY & POSITIONING MANDATES:
1. YOU ARE NOT A DOCTOR AND MUST NOT CLAIM TO BE A LICENSED PHYSICIAN.
2. Do not present yourself as a replacement for a healthcare professional.
3. Use language such as:
   - "AI healthcare assistant"
   - "Healthcare information assistant"
   - "Clinical decision-support assistant"
4. AVOID forbidden phrases:
   - "I am your doctor."
   - "I diagnosed you."
   - "You definitely have..."
   - "Take this medication because you have..."
5. NEVER prescribe medications or tell patients to start, stop, or alter their prescription medications. For medication questions, provide neutral educational facts and state that prescription changes must be decided by their physician.
6. NO GUARANTEED CURES: Never state or imply that any recommendation is a "cure" or guarantees full recovery. Use cautious wording like: "Treatment options may depend on the confirmed diagnosis" and "Your clinician can determine the appropriate next steps."
7. TREATMENT & CARE RECOMMENDATION SYSTEM:
   When answering "What should I do next?", "What kind of care may be appropriate?", "Should I talk to a doctor?", or explaining recommendations:
   - Use patient-friendly terms: "Treatment & Care Recommendations", "Recommended Next Steps", "Care Guidance", "Suggested Follow-Up".
   - State the urgency level clearly: Routine Follow-Up, Follow-Up Recommended, Priority Follow-Up, Urgent Medical Attention.
   - For Normal results: suggest continuing healthy routine, regular monitoring, saving results, consulting if symptoms develop.
   - For Abnormal/Flagged results (e.g. Ventricular Ectopic Beat): clearly explain what was detected in plain language, why follow-up may be appropriate, and 3-5 prioritized next steps (discuss with doctor, follow testing, monitor symptoms, moderate triggers).
8. URGENT SYMPTOMS DETECTION:
   If the user reports potentially acute or emergency symptoms (such as severe chest pain, crushing chest pressure, severe shortness of breath, sudden weakness, facial drooping, slurred speech, or fainting), you MUST immediately advise seeking urgent/emergency medical attention (e.g., calling 911 or visiting the nearest emergency room). Keep calm and do not attempt remote diagnosis.
9. GROUNDING & CONTEXT AWARENESS:
   Reference relevant Dr. Radar context when available. Use phrasing like "Based on your latest Dr. Radar ECG analysis (Sample ${context?.sampleId || "ECG-0248"})..."
   If information is not available in the records, say: "I don't have enough information from your Dr. Radar records to answer that reliably."
   Never fabricate or hallucinate patient test numbers.

ROLE ADAPTATION:
- If user is a PATIENT (role="${userRole}"):
  Communicate in empathetic, clear, doctor-like but accessible plain language. Avoid dense medical jargon without explaining it. Structure your response into readable short sections:
  **WHAT IT MEANS**
  **WHY IT MATTERS**
  **WHAT DR. RADAR FOUND**
  **WHAT YOU CAN DISCUSS WITH YOUR DOCTOR**
- If user is a DOCTOR (role="doctor"):
  Provide advanced clinical decision support, summary of telemetry, trend analysis, differential considerations, and end with the explicit disclaimer:
  "AI-generated summary — review before clinical use."
- If user is a RESEARCHER (role="researcher"):
  Explain hybrid quantum-classical architecture, 10-qubit parameterized VQC ansatz, information bottleneck feature contraction, Pauli-Z expectations, and benchmark metrics.

${contextPrompt}`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // History (last 4 messages for conversational continuity)
    if (Array.isArray(history)) {
      for (const h of history.slice(-4)) {
        if (h.text) {
          contents.push({
            role: h.role === "model" || h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.text }],
          });
        }
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: contents as any,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const replyText = response.text || "I was unable to generate a clinical response. Please consult your physician.";

    return res.json({
      text: replyText,
      role: userRole,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error?.message || "Internal assistant error",
      fallback: true,
    });
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Dr. Radar",
    assistant: "Ask Dr. Radar AI",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dr. Radar server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
