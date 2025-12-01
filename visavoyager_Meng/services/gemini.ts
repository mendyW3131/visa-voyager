import { GoogleGenAI, Type } from "@google/genai";
import {
  VisaPolicy,
  DocumentItem,
  VisaPurpose,
  DocTemplate,
  AgentEvaluation,
  SafetyTip,
  UserProfile,
} from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

/**
 * ============================================================================
 * VISAVOYAGER: AGENTIC CORE SERVICES
 * ============================================================================
 *
 * ARCHITECTURE OVERVIEW:
 * This file implements a "Client-Side Agentic Orchestration" pattern.
 * We have built a Custom Agent Framework on top of the Google GenAI SDK to
 * manage state, memory, and tool execution in the browser.
 *
 * KEY ARCHITECTURAL PATTERNS:
 * 1. Agent Wrappers: Custom 'AgentSession' class that manages history & config.
 * 2. Multi-Agent Swarm: Specialized personas (Consultant, Guide, Drafter).
 * 3. Self-Healing Loops: The 'Auditor' agent critiques and retries failed searches.
 * 4. Grounding: Strict use of 'googleSearch' for factual verification.
 * 5. Multimodality: Vision Agent for Passport OCR.
 */

/**
 * CUSTOM AGENT SESSION (The "Brain")
 * A wrapper class that provides Agent capabilities:
 * - Manages Chat Session (Context Window/Memory)
 * - Injects System Instructions (Persona)
 * - Configures Tools (Google Search, Maps)
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

  // Lazy initialization of the chat session to save resources
  private getSession() {
    if (!this.chat) {
      this.chat = ai.chats.create({
        model: this.model,
        config: {
          systemInstruction: this.config.systemInstruction,
          tools: this.config.tools,
        },
        history: this.history,
      });
    }
    return this.chat;
  }

  // Clears "Short-Term Memory" to prevent context pollution between tasks
  public clearSession() {
    this.chat = null;
    this.history = [];
  }

  // Executes a turn. Supports strict JSON output via 'outputSchema'
  async run(
    prompt: string,
    outputSchema?: any
  ): Promise<{ text: string; raw: any }> {
    const session = this.getSession();
    const result = await session.sendMessage({
      message: prompt,
      ...(outputSchema && {
        config: {
          responseMimeType: "application/json",
          responseSchema: outputSchema,
        },
      }),
    });
    return { text: result.text, raw: result };
  }
}

/**
 * ============================================================================
 * AGENT SWARM DEFINITIONS (PERSONAS)
 * ============================================================================
 */

// --- AGENT 1: VISA CONSULTANT ---
// ROLE: Researcher & Policy Expert
// CAPABILITIES: Grounding (Google Search), Geolocation (Maps)
// BEHAVIOR: Strictly factual, must cite sources.
const visaConsultant = new AgentSession("gemini-2.5-flash", {
  systemInstruction:
    "You are an expert Visa Consultant. Your goal is to find the most accurate, up-to-date visa policies. You MUST use Google Search to verify facts.",
  tools: [{ googleSearch: {} }, { googleMaps: {} }],
});

// --- AGENT 2: TRAVEL GUIDE ---
// ROLE: Cultural Context Expert
// CAPABILITIES: Search
// BEHAVIOR: Provides soft-skills advice (safety, etiquette) to complement the hard legal data.
const travelGuide = new AgentSession("gemini-2.5-flash", {
  systemInstruction:
    "You are a local cultural expert. You provide safety tips and cultural etiquette advice for travelers.",
  tools: [{ googleSearch: {} }],
});

// --- AGENT 3 & 4: LEGAL DRAFTER & CHECKLIST SPECIALIST ---
// ROLE: Specialist / Worker
// CAPABILITIES: Deterministic Logic, Text Generation
// BEHAVIOR: Precise, formal, follows JSON schemas strictly.
// Note: We use a single 'Legal' persona for both drafting and checklists to maintain consistent tone.
const legalDrafter = new AgentSession("gemini-2.5-flash", {
  systemInstruction:
    "You are a professional legal document drafter for immigration purposes. You are precise, formal, and detail-oriented.",
});

// --- AGENT 6: THE AUDITOR (System Prompt Definition) ---
// ROLE: Quality Assurance
// BEHAVIOR: Adversarial. It tries to find flaws in the Consultant's output.
const AUDITOR_SYSTEM_PROMPT = `You are an AI Output Auditor. 
Task: Evaluate the quality of the provided JSON data.
Criteria: Completeness, Source Validity, and Logic.
Return strict JSON evaluation.`;

/* -------------------------------------------------------------------------- */
/*                             Orchestration Layer                            */
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

// --- PARALLEL AGENT FUNCTION ---
// This runs concurrently with the main search to reduce perceived latency.
export const getTravelAdvisory = async (
  destination: string
): Promise<SafetyTip[]> => {
  travelGuide.clearSession();
  const { text } = await travelGuide.run(
    `Give me 3 critical safety or cultural etiquette tips for a tourist visiting ${destination}.`,
    {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          tip: { type: Type.STRING },
        },
      },
    }
  );
  return JSON.parse(text || "[]");
};

// --- MAIN ORCHESTRATOR FUNCTION ---
// This function manages the entire Search -> Verify -> Retry workflow.
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
    let verification: AgentEvaluation = {
      score: 0,
      pass: false,
      reasoning: "",
    };

    // JSON Schema serves as the "Policy Structurer Agent", forcing unstructured search results
    // into a strictly typed format our UI can render.
    const schema = {
      type: Type.OBJECT,
      properties: {
        visaStatus: {
          type: Type.STRING,
          enum: [
            "visa_required",
            "visa_free",
            "e_visa",
            "on_arrival",
            "unknown",
          ],
        },
        summary: { type: Type.STRING },
        whatsNext: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
        },
        timeline: { type: Type.STRING },
        requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        sources: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              uri: { type: Type.STRING },
            },
          },
        },
      },
    };

    // --- FEATURE: SELF-CORRECTION LOOP ---
    // The agent will loop until the Auditor is satisfied or MAX_RETRIES is reached.
    while (attempts <= MAX_RETRIES) {
      let prompt = `Find requirements for ${citizenship} citizen residing in ${residency} visiting ${destination} for ${purpose}.
      Use Google Search. Return JSON with status, timeline, requirements, and SOURCES.`;

      if (attempts > 0) {
        // RETRY LOGIC: Feed the Auditor's critique back into the prompt
        if (onProgress)
          onProgress(`Self-Correcting (Attempt ${attempts + 1})...`);
        prompt = `Previous answer quality was poor: "${verification.reasoning}". Fix missing sources/details. Search again.`;
      } else {
        if (onProgress) onProgress("Consulting Official Sources...");
      }

      // EXECUTE: Consultant Agent (with Structurer Schema)
      const { text, raw } = await visaConsultant.run(prompt, schema);
      currentData = JSON.parse(text || "{}");

      // SOURCE AGGREGATION
      // Combines explicit JSON sources with implicit Grounding Metadata
      const jsonSources = currentData.sources || [];
      const metadataSources =
        raw.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.map((chunk: any) =>
            chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null
          )
          .filter(Boolean) || [];
      const allSources = [...jsonSources, ...metadataSources];
      currentSources = Array.from(
        new Map(allSources.map((s) => [s.uri, s])).values()
      );

      // --- FEATURE: AGENT EVALUATION (AUDITOR) ---
      if (onProgress) onProgress("Verifying Accuracy (AI Auditor)...");

      // Spawns the Auditor to critique the output using a strictly logical rubric
      const evalResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${AUDITOR_SYSTEM_PROMPT} \n Data: ${JSON.stringify(
          currentData
        )} \n Sources Count: ${currentSources.length}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              pass: { type: Type.BOOLEAN },
              reasoning: { type: Type.STRING },
            },
          },
        },
      });
      verification = JSON.parse(evalResponse.text || '{"score": 0}');

      // MANUAL PENALTY: Force retry if no sources found (hallucination prevention)
      if (currentSources.length === 0) {
        verification.score = Math.min(verification.score, 5);
        verification.reasoning += " Missing official sources.";
      }

      // Success condition
      if (verification.score >= 8) break;
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
      verification, // The UI uses this score to display the "Confidence Badge"
    };
  } catch (error) {
    console.error("Agent failed:", error);
    throw error;
  }
};

export const generateDocumentChecklist = async (
  policy: VisaPolicy
): Promise<DocumentItem[]> => {
  // --- AGENT 4: CHECKLIST SPECIALIST ---
  // Uses context from the previous search to generate a specific To-Do list
  const isVisaFree = policy.visaStatus === "visa_free";
  const { text } = await legalDrafter.run(
    `Generate a JSON checklist for ${policy.country}. Status: ${
      policy.visaStatus
    }. ${isVisaFree ? "Entry docs only." : "Visa application docs."}`,
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

export const generateVisaDocument = async (
  template: DocTemplate,
  data: Record<string, string>
): Promise<string> => {
  // --- AGENT 3: DRAFTER AGENT ---
  // Uses UserProfile memory + Trip Context to deterministicly write legal letters
  const { text } = await legalDrafter.run(
    `Write a ${template} for ${data.destination}. Details: ${JSON.stringify(
      data
    )}. Format: Professional. NO header block.`
  );
  return text;
};

// --- AGENT 5: VISION AGENT (PASSPORT PARSER) ---
// FEATURE: MULTIMODALITY
// Uses Gemini 2.5 Flash Vision to perform OCR and entity extraction on ID documents.
export const parsePassportImage = async (
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<Partial<UserProfile>> => {
  const prompt = `Analyze this ID. Extract JSON: fullName, passportNumber, citizenship, dateOfBirth (YYYY-MM-DD), passportExpiry (YYYY-MM-DD). Return null if unclear.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } }, // Multimodal Input (Image)
        { text: prompt }, // Multimodal Input (Text)
      ],
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
        },
      },
    },
  });

  let cleanedText = response.text || "{}";
  // Robustness: Strip markdown code blocks if the model includes them
  if (cleanedText.startsWith("```"))
    cleanedText = cleanedText
      .replace(/^```(json)?\n/, "")
      .replace(/\n```$/, "");

  const result = JSON.parse(cleanedText);
  if (!result.passportNumber && !result.fullName)
    throw new Error("Could not extract details.");

  return result;
};
