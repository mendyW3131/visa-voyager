import { Type } from "@google/genai";

export interface VisaPurpose {
  id: string;
  label: string;
  description: string;
}

export interface VisaStep {
  title: string;
  description: string;
}

// Result of the 'Auditor Agent' evaluation
export interface AgentEvaluation {
  score: number; // 1-10
  reasoning: string;
  pass: boolean;
}

// The Long-Term Memory (Memory Bank) entity
export interface UserProfile {
  citizenship: string;
  residency: string;
  fullName?: string;
  passportNumber?: string;
  dateOfBirth?: string;
  passportExpiry?: string;
  email?: string;
  phone?: string;
  homeAddress?: string;
}

export type ProcessingStage = 'IDLE' | 'SEARCHING' | 'ANALYZING' | 'VERIFYING' | 'COMPLETED';

export interface SafetyTip {
  category: string;
  tip: string;
}

// Maps to the JSON Schema used by the Consultant/Structurer Agent
export interface VisaPolicy {
  country: string;
  citizenship: string;
  residency: string;
  purpose: string;
  visaStatus: 'visa_required' | 'visa_free' | 'e_visa' | 'on_arrival' | 'unknown';
  summary: string;
  whatsNext: VisaStep[];
  timeline: string;
  requirements: string[];
  lastUpdated?: string;
  sources: { title: string; uri: string }[];
  // Parallel Agent Data
  travelTips?: SafetyTip[];
  // ADK Evaluation Feature
  verification: AgentEvaluation;
}

export interface DocumentItem {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
  completed: boolean;
}

export enum AppSection {
  SEARCH = 'SEARCH',
  CHECKLIST = 'CHECKLIST',
  DOC_BUILDER = 'DOC_BUILDER'
}

export type DocTemplate = 'cover-letter' | 'itinerary' | 'employment-proof';

export interface GeneratedDoc {
  title: string;
  content: string;
}