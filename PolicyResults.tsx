import React, { useState } from 'react';
import { VisaPolicy, DocumentItem } from '../types';
import { generateDocumentChecklist } from '../services/gemini';
import { CheckSquare, Loader2, Clock, Map, ArrowRightCircle, ChevronDown, ChevronUp, ShieldCheck, FileCheck, Sparkles, AlertTriangle, Eye, Ban, HelpCircle } from 'lucide-react';

interface PolicyResultsProps {
  policy: VisaPolicy;
  onGenerateChecklist: (items: DocumentItem[]) => void;
}

export const PolicyResults: React.FC<PolicyResultsProps> = ({ policy, onGenerateChecklist }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [openStepIndex, setOpenStepIndex] = useState<number | null>(0);
  const [showPreliminaryDetails, setShowPreliminaryDetails] = useState(false);

  const handleStartApplication = async () => {
    setIsGenerating(true);
    try {
      const items = await generateDocumentChecklist(policy);
      onGenerateChecklist(items);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'visa_free': return 'bg-green-100 text-green-800 border-green-200';
      case 'e_visa': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'visa_required': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'visa_free': return 'Visa Free Travel';
      case 'e_visa': return 'E-Visa Required';
      case 'visa_required': return 'Visa Required';
      case 'on_arrival': return 'Visa On Arrival';
      default: return 'Status Unknown';
    }
  };

  const isVisaFree = policy.visaStatus === 'visa_free';
  const evalScore = policy.verification?.score || 0;
  
  // Logic for UI States
  const isCriticalFailure = evalScore < 3;
  const isHighConfidence = evalScore >= 8;
  const showContent = isHighConfidence || showPreliminaryDetails;

  // 1. CRITICAL FAILURE STATE (< 3/10)
  if (isCriticalFailure) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="bg-slate-900 p-6 text-white">
             <h2 className="text-2xl font-bold flex items-center gap-3">
                {policy.country}
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-500/20 text-red-200 border border-red-500/50">
                  Data Unavailable
                </span>
             </h2>
             <p className="text-slate-400 text-sm mt-1">
                {policy.purpose} • Citizen of {policy.citizenship}
              </p>
          </div>
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Ban className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">We couldn't find reliable info</h3>
            <p className="text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
                The AI confidence score for this search was too low ({evalScore}/10). 
                To ensure your safety and prevent misinformation, we have blocked these results.
            </p>
            <div className="p-4 bg-slate-50 rounded-xl inline-block text-left max-w-sm border border-slate-200">
               <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Recommendation</span>
               <p className="text-sm text-slate-700">
                 Please consult the official embassy website or a professional visa agency directly.
               </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                {policy.country}
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusColor(policy.visaStatus)}`}>
                  {getStatusLabel(policy.visaStatus)}
                </span>
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {policy.purpose} • Citizen of {policy.citizenship} • From {policy.residency}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/50 border-2 border-blue-400">
              <span className="text-xl font-bold">{policy.country.substring(0, 2).toUpperCase()}</span>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {/* Preliminary Warning Banner (Only shown if NOT high confidence) */}
          {!isHighConfidence && (
            <div className="mb-6 border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl shadow-sm bg-white text-amber-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base mb-1 text-amber-800">
                    Preliminary Result - Please verify with Embassy
                  </h4>
                  <p className="text-sm leading-snug text-amber-700">
                     {policy.verification?.reasoning || "Reasoning unavailable"}
                  </p>
                </div>
              </div>

              {!showPreliminaryDetails && (
                 <button 
                   onClick={() => setShowPreliminaryDetails(true)}
                   className="whitespace-nowrap px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-semibold rounded-lg transition-colors flex items-center"
                 >
                   <Eye className="w-4 h-4 mr-2" />
                   View Preliminary Results
                 </button>
              )}
            </div>
          )}

          {/* Collapsible Content Area */}
          {showContent ? (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              
              {/* Timeline Info (Full Width now) */}
              <div className="mb-8">
                 <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start hover:border-blue-200 transition-colors">
                    <Clock className="w-5 h-5 text-slate-500 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Processing & Timeline</span>
                      <p className="text-slate-900 text-sm leading-relaxed font-medium">
                          {policy.timeline}
                      </p>
                    </div>
                 </div>
              </div>

              {/* Parallel Agent Insight: Travel Tips */}
              {policy.travelTips && policy.travelTips.length > 0 && (
                <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                   <div className="flex items-center mb-3">
                     <div className="bg-white p-1.5 rounded-lg shadow-sm mr-3">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                     </div>
                     <h3 className="font-bold text-indigo-900">Local Insights & Safety</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {policy.travelTips.map((tip, idx) => (
                        <div key={idx} className="bg-white/80 p-3 rounded-lg text-sm border border-indigo-100/50">
                           <span className="block text-xs font-bold text-indigo-500 uppercase mb-1">{tip.category}</span>
                           <p className="text-indigo-900 leading-snug">{tip.tip}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {/* What's Next Accordion */}
              <div className="mb-8">
                <div className="flex items-center mb-4">
                  <Map className="w-5 h-5 mr-2 text-blue-600" />
                  <h3 className="text-lg font-bold text-slate-800">
                    What's Next?
                  </h3>
                  
                  {/* Verified Badge - Only shown if High Confidence */}
                  {isHighConfidence && (
                    <div className="group relative ml-3 inline-flex items-center">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-help bg-blue-100 text-blue-800 border-blue-200`}>
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          High Confidence
                          <HelpCircle className="w-3 h-3 ml-1 text-blue-600 opacity-50" />
                        </div>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <p className="font-semibold mb-1">AI Reliability Score: {evalScore}/10</p>
                            <p className="leading-snug">
                                The AI has internally verified this information against its knowledge base and strict validation criteria.
                            </p>
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800"></div>
                        </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {policy.whatsNext.map((step, index) => (
                    <div 
                      key={index} 
                      className={`border rounded-xl transition-all duration-200 overflow-hidden ${
                        openStepIndex === index ? 'border-blue-200 bg-blue-50/30 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <button
                        onClick={() => setOpenStepIndex(openStepIndex === index ? null : index)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                            openStepIndex === index ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {index + 1}
                          </div>
                          <span className={`font-semibold ${openStepIndex === index ? 'text-blue-900' : 'text-slate-700'}`}>
                            {step.title}
                          </span>
                        </div>
                        {openStepIndex === index ? (
                          <ChevronUp className="w-5 h-5 text-blue-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          openStepIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="p-4 pt-0 pl-[4.5rem] text-slate-600 text-sm leading-relaxed">
                          {step.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Footer */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-slate-500 flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-2 text-green-600" />
                  {isVisaFree ? 'Prepare your entry documents' : 'Start organizing your application'}
                </div>
                <button
                  onClick={handleStartApplication}
                  disabled={isGenerating}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center shadow-lg transform hover:-translate-y-0.5 ${
                    isVisaFree 
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      Preparing Checklist...
                    </>
                  ) : (
                    <>
                      {isVisaFree ? <FileCheck className="w-6 h-6 mr-2" /> : <CheckSquare className="w-6 h-6 mr-2" />}
                      {isVisaFree ? 'Get Entry Checklist' : 'Start Application Prep'}
                      <ArrowRightCircle className="w-5 h-5 ml-2 opacity-70" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Placeholder when content is collapsed (Low Confidence State)
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
               <div className="flex flex-col items-center">
                 <Ban className="w-8 h-8 mb-2 opacity-50" />
                 <p className="text-sm">Details hidden due to low verification score.</p>
                 <button 
                   onClick={() => setShowPreliminaryDetails(true)}
                   className="mt-4 text-blue-600 text-sm font-semibold hover:underline"
                 >
                   I understand, show me anyway
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};