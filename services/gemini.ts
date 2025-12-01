import { GoogleGenAI, Type } from "@google/genai";
import { VisaPolicy, DocumentItem, VisaPurpose, DocTemplate, AgentEvaluation, SafetyTip, UserProfile } from "../types";

// NOTE: Ensure your .env file uses VITE_API_KEY for frontend access.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || (import.meta as any).env.VITE_API_KEY });

/**
 * ============================================================================
 * 🧠 VISAVOYAGER: CUSTOM AGENT FRAMEWORK (CLIENT-SIDE)
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * Unlike traditional server-side agent frameworks, VisaVoyager implements a 
 * "Client-Side Agentic Orchestration" pattern.
 * 
 * CORE COMPONENTS:
 * 1. ORCHESTRATOR: The functions below (searchVisaInfo, etc.) manage the flow.
 * 2. AGENT SWARM: Specialized personas (Consultant, Guide, Drafter) with distinct tools.
 * 3. MEMORY BANK: The AgentSession class manages context windows and history.
 * 4. SELF-HEALING: A "Loop" architecture that critiques and fixes its own output.
 */

/**
 * 🧱 AGENT SESSION WRAPPER
 * Handles memory management, tool configuration, and LLM interaction.
 * Acts as the "Runtime" for our agents.
 */
class AgentSession {
  private chat: any;
  private history: any[] = [];

  constructor(
    private model: string,
    private config: {
      systemInstruction: string;
      tools?: any[];
    }
  ) {}

  /**
   * Lazy initialization of the chat session to preserve resources.
   */
  private getSession() {
    if (!this.chat) {
      this.chat = ai.chats.create({
        model: this.model,
        config: {
          systemInstruction: this.config.systemInstruction,
          tools: this.config.tools,
        },
        history: this.history
      });
    }
    return this.chat;
  }

  /**
   * Clears ephemeral memory (RAM) to prevent hallucination between distinct tasks.
   * (Long-term memory is handled by the UserProfile in App.tsx)
   */
  public clearSession() {
    this.chat = null;
    this.history = [];
  }

  async run(prompt: string, outputSchema?: any): Promise<{ text: string; raw: any }> {
    const session = this.getSession();
    
    // We dynamically inject schema configuration when the agent needs 
    // to act as a "Structurer" (converting raw thought to JSON).
    const requestOptions: any = {
      message: prompt,
      ...(outputSchema && {
        config: {
          responseMimeType: "application/json",
          responseSchema: outputSchema,
        }
      })
    };

    const result = await session.sendMessage(requestOptions);
    return { text: result.text, raw: result };
  }

  /**
   * ⚖️ FEATURE: AGENT EVALUATION (THE AUDITOR)
   * This method spawns a temporary "Auditor Agent" to critique the output 
   * of the main agent. It implements the "Reflexion" pattern.
   */
  async evaluateOutput(content: string, criteria: string): Promise<AgentEvaluation> {
    const evalResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an AI Output Auditor. 
      
      Task: Evaluate the quality of the following JSON data based on these criteria: "${criteria}".
      
      Data to Evaluate:
      ${content.substring(0, 3000)}
      
      Return JSON with:
      - score: number (1-10, where 10 is perfect)
      - pass: boolean (true if usable, false if hallucinated or broken)
      - reasoning: string (brief explanation)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            pass: { type: Type.BOOLEAN },
            reasoning: { type: Type.STRING },
          }
        }
      }
    });

    return JSON.parse(evalResponse.text || '{"score": 0, "pass": false, "reasoning": "Evaluation failed"}');
  }
}

/* -------------------------------------------------------------------------- */
/*                        🤖 AGENT SWARM DEFINITIONS                          */
/* -------------------------------------------------------------------------- */

// --- AGENT 1: CONSULTANT AGENT ---
// Role: Researcher & Policy Expert
// Capabilities: Grounding via Google Search, Location verification via Maps
const visaConsultant = new AgentSession(
  "gemini-2.5-flash", 
  {
    systemInstruction: "You are an expert Visa Consultant. Your goal is to find the most accurate, up-to-date visa policies. You MUST use Google Search to verify facts. You can use Google Maps to check embassy locations if relevant.",
    tools: [
      { googleSearch: {} }, 
      { googleMaps: {} }
    ] 
  }
);

// --- AGENT 2: GUIDE AGENT ---
// Role: Cultural Context Expert
// Execution: Runs in PARALLEL with Consultant Agent (see VisaSearch.tsx)
const travelGuide = new AgentSession(
  "gemini-2.5-flash",
  {
    systemInstruction: "You are a local cultural expert. You provide safety tips and cultural etiquette advice for travelers.",
    tools: [{ googleSearch: {} }]
  }
);

// --- AGENT 3: DRAFTER AGENT (formerly docSpecialist) ---
// Role: Legal writing, Logic parsing, Checklist generation
// Behavior: Deterministic, Formal, Precise
const legalDrafter = new AgentSession(
  "gemini-2.5-flash",
  {
    systemInstruction: "You are a professional legal document drafter for immigration purposes."
  }
);

/* -------------------------------------------------------------------------- */
/*                        🎼 ORCHESTRATION LAYER                              */
/* -------------------------------------------------------------------------- */

export const getCommonVisaPurposes = async (
  citizenship: string,
  destination: string
): Promise<VisaPurpose[]> => {
  visaConsultant.clearSession();
  
  const { text } = await visaConsultant.run(
    `Suggest 5 common visa purposes for a ${citizenship} citizen visiting ${destination}. Return JSON only.`,
    {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          description: { type: Type.STRING },
        },
      },
    }
  );
  return JSON.parse(text || "[]");
};

// Orchestrates the "Guide Agent"
export const getTravelAdvisory = async (destination: string): Promise<SafetyTip[]> => {
  travelGuide.clearSession();
  const { text } = await travelGuide.run(
    `Give me 3 critical safety or cultural etiquette tips for a tourist visiting ${destination}.`,
    {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          tip: { type: Type.STRING }
        }
      }
    }
  );
  return JSON.parse(text || "[]");
};

/**
 * ⚙️ MAIN WORKFLOW: SEARCH & VERIFY
 * This function demonstrates the "Loop Agent" pattern.
 * It searches, structures, evaluates, and self-corrects.
 */
export const searchVisaInfo = async (
  citizenship: string,
  residency: string,
  destination: string,
  purpose: string,
  onProgress?: (stage: string) => void
): Promise<VisaPolicy> => {
  try {
    visaConsultant.clearSession();

    let attempts = 0;
    const MAX_RETRIES = 2; 
    let currentData: any = {};
    let currentSources: any[] = [];
    let verification: AgentEvaluation = { score: 0, pass: false, reasoning: "" };

    const schema = {
      type: Type.OBJECT,
      properties: {
        visaStatus: { type: Type.STRING, enum: ["visa_required", "visa_free", "e_visa", "on_arrival", "unknown"] },
        summary: { type: Type.STRING },
        whatsNext: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
          },
        },
        timeline: { type: Type.STRING },
        requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        sources: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { title: { type: Type.STRING }, uri: { type: Type.STRING } }
          }
        }
      },
    };

    // --- 🔁 SELF-CORRECTION LOOP ---
    // If the Auditor Score is low, the agent loops back with the critique inserted into its context.
    while (attempts <= MAX_RETRIES) {
      let prompt = `Find current visa requirements for:
      - Citizen of: ${citizenship}
      - Residing in: ${residency}
      - Destination: ${destination}
      - Purpose: ${purpose}

      I need a structured JSON response with status, summary, steps, timeline, requirements, and sources.
      Use Google Search to ensure data is current for ${new Date().getFullYear()}.
      IMPORTANT: The 'sources' array is MANDATORY. Extract URLs from search results.`;

      if (attempts > 0) {
        if (onProgress) onProgress(`Self-Correcting (Attempt ${attempts + 1})...`);
        // 💉 INJECTION: We feed the Auditor's reasoning back into the prompt
        prompt = `The previous answer was insufficient. Critique: "${verification.reasoning}". 
        Please fix this. Search specifically for the missing information (especially official sources) and update the JSON.`;
      } else {
        if (onProgress) onProgress("Consulting Official Sources...");
      }

      // EXECUTE AGENT (Consultant + Structurer)
      const { text, raw } = await visaConsultant.run(prompt, schema);
      currentData = JSON.parse(text || "{}");

      // AGGREGATE SOURCES (Explicit JSON + Implicit Grounding Metadata)
      const jsonSources = currentData.sources || [];
      const metadataSources = raw.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
        .filter(Boolean) || [];
      
      const allSources = [...jsonSources, ...metadataSources];
      const uniqueSourcesMap = new Map();
      allSources.forEach(s => {
        if (s.uri && !uniqueSourcesMap.has(s.uri)) {
          uniqueSourcesMap.set(s.uri, s);
        }
      });
      currentSources = Array.from(uniqueSourcesMap.values());

      // --- ⚖️ AUDITOR STEP ---
      if (onProgress) onProgress("Verifying Accuracy (AI Auditor)...");
      
      verification = await visaConsultant.evaluateOutput(
        text,
        `Does the data contain a definitive visa status? Is the timeline specific? 
         CRITICAL: Does the 'sources' array contain at least one valid URL?`
      );

      // Manual Guardrail: Penalize missing sources
      if (currentSources.length === 0) {
        verification.score = Math.min(verification.score, 5);
        verification.pass = false;
        verification.reasoning = (verification.reasoning || "") + " Missing official source links.";
      }

      // Exit Strategy: If score is high enough, break the loop
      if (verification.score >= 8) {
        break;
      }
      
      attempts++;
    }

    return {
      country: destination,
      citizenship,
      residency,
      purpose,
      visaStatus: currentData.visaStatus || "unknown",
      summary: currentData.summary || "Summary not available",
      whatsNext: currentData.whatsNext || [],
      timeline: currentData.timeline || "Check official sources",
      requirements: currentData.requirements || [],
      sources: currentSources,
      verification 
    };

  } catch (error) {
    console.error("Agent failed:", error);
    throw error;
  }
};

// Orchestrates the "Drafter Agent" for Checklists
export const generateDocumentChecklist = async (policy: VisaPolicy): Promise<DocumentItem[]> => {
  const isVisaFree = policy.visaStatus === "visa_free";
  
  const { text } = await legalDrafter.run(
    `Generate a JSON checklist for ${policy.country}. Status: ${policy.visaStatus}.
     ${isVisaFree ? "Only entry docs (Passport, Ticket)." : "Full visa application docs."}`,
    {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          isRequired: { type: Type.BOOLEAN },
        },
      },
    }
  );

  const items = JSON.parse(text || "[]");
  return items.map((item: any) => ({ ...item, completed: false }));
};

// Orchestrates the "Drafter Agent" for Legal Docs
export const generateVisaDocument = async (
  template: DocTemplate,
  data: Record<string, string>
): Promise<string> => {
  const { text } = await legalDrafter.run(
    `Write a ${template} for ${data.destination}. 
    Details: ${JSON.stringify(data)}. 
    Format: Professional, formal tone.
    IMPORTANT: Do NOT include the top formal letter header block (Sender Name/Address, Phone, Email, Date, Recipient Address). 
    Start directly with the Subject Line or Salutation.`
  );
  return text;
};

/**
 * 👁️ MULTIMODAL AGENT: PASSPORT PARSER (VISION)
 * Demonstrates Gemini's ability to "see" documents and extract structured entities.
 */
export const parsePassportImage = async (base64Image: string, mimeType: string = "image/jpeg"): Promise<Partial<UserProfile>> => {
  const prompt = `Analyze this image of a passport or identification document.
  Extract the following information into a strict JSON object:
  - fullName
  - passportNumber
  - citizenship
  - dateOfBirth (YYYY-MM-DD)
  - passportExpiry (YYYY-MM-DD)
  
  If a field is not visible or cannot be read, return null. 
  Do not be strict about document validity; extract any text that looks like the requested fields.`;

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Vision-capable model
    contents: {
      parts: [imagePart, { text: prompt }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING },
          passportNumber: { type: Type.STRING },
          citizenship: { type: Type.STRING },
          dateOfBirth: { type: Type.STRING },
          passportExpiry: { type: Type.STRING },
        }
      }
    }
  });

  let cleanedText = response.text || "{}";
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.replace(/^```(json)?\n/, "").replace(/\n```$/, "");
  }

  const result = JSON.parse(cleanedText);

  if (!result.passportNumber && !result.fullName) {
    throw new Error("Could not extract passport details. The image might be too blurry or obscure.");
  }

  return {
    fullName: result.fullName,
    passportNumber: result.passportNumber,
    citizenship: result.citizenship,
    dateOfBirth: result.dateOfBirth,
    passportExpiry: result.passportExpiry
  };
};
