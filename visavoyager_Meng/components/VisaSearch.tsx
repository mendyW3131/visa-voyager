import React, { useState, useEffect } from 'react';
import { Search, Globe, Loader2, ArrowRight, ArrowLeft, Plane, Sparkles, ListChecks } from 'lucide-react';
import { searchVisaInfo, getCommonVisaPurposes, getTravelAdvisory } from '../services/gemini';
import { VisaPolicy, VisaPurpose, UserProfile } from '../types';

interface VisaSearchProps {
  onPolicyFound: (policy: VisaPolicy) => void;
  userProfile: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
}

type SearchStep = 'LOCATION' | 'PURPOSE';

export const VisaSearch: React.FC<VisaSearchProps> = ({ onPolicyFound, userProfile, onUpdateProfile }) => {
  const [step, setStep] = useState<SearchStep>('LOCATION');
  
  // Local state initialized from props (Memory Bank)
  const [citizenship, setCitizenship] = useState(userProfile.citizenship);
  const [residency, setResidency] = useState(userProfile.residency);
  const [destination, setDestination] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing Agents...'); 
  const [error, setError] = useState('');
  
  // Purpose Step State
  const [purposes, setPurposes] = useState<VisaPurpose[]>([]);
  const [selectedPurposeId, setSelectedPurposeId] = useState<string>('');

  useEffect(() => {
    if (userProfile.citizenship) setCitizenship(userProfile.citizenship);
    if (userProfile.residency) setResidency(userProfile.residency);
  }, [userProfile]);

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenship || !destination || !residency) return;

    setIsLoading(true);
    setError('');
    
    // Update Memory Bank
    onUpdateProfile({ citizenship, residency });

    try {
      const availablePurposes = await getCommonVisaPurposes(citizenship, destination);
      setPurposes(availablePurposes);
      setStep('PURPOSE');
    } catch (err) {
      setError('Could not determine visa types. Please verify country names.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurposeSubmit = async () => {
    if (!selectedPurposeId) return;
    const purposeObj = purposes.find(p => p.id === selectedPurposeId);
    if (!purposeObj) return;

    setIsLoading(true);
    setError('');
    setLoadingStatus('Coordinating Agents...');

    try {
      // --- ARCHITECTURAL HIGHLIGHT: PARALLEL AGENT EXECUTION ---
      // Instead of sequential waterfalls, we fire the Visa Consultant (Legal) 
      // and Travel Guide (Context) simultaneously using Promise.all.
      // This minimizes latency and provides a richer result set.
      const [policy, tips] = await Promise.all([
        searchVisaInfo(
          citizenship, 
          residency, 
          destination, 
          purposeObj.label,
          (stage) => setLoadingStatus(stage)
        ),
        getTravelAdvisory(destination)
      ]);

      // Merge the results
      const finalPolicy: VisaPolicy = {
        ...policy,
        travelTips: tips
      };

      onPolicyFound(finalPolicy);
    } catch (err) {
      setError('Failed to fetch visa information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-full mb-4">
          <Globe className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          {step === 'LOCATION' ? "Where are you going?" : `Check ${destination} visa`}
        </h1>
        <p className="text-slate-600">
          {step === 'LOCATION' 
            ? "Check the latest visa requirements and get help with your application."
            : `What are you coming to ${destination} to do?`
          }
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        {step === 'LOCATION' ? (
          <form onSubmit={handleLocationSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">I am a citizen of</label>
                <input
                  type="text"
                  placeholder="e.g., United States"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={citizenship}
                  onChange={(e) => setCitizenship(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Currently residing in</label>
                <input
                  type="text"
                  placeholder="e.g., United Kingdom"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={residency}
                  onChange={(e) => setResidency(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Traveling to</label>
                <input
                  type="text"
                  placeholder="e.g., Japan"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !citizenship || !destination || !residency}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/30"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Checking Options...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              {purposes.map((purpose) => (
                <label 
                  key={purpose.id} 
                  className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-slate-50 ${
                    selectedPurposeId === purpose.id 
                      ? 'border-blue-600 bg-blue-50/50' 
                      : 'border-transparent hover:border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="visa_purpose"
                    value={purpose.id}
                    checked={selectedPurposeId === purpose.id}
                    onChange={() => setSelectedPurposeId(purpose.id)}
                    className="hidden"
                  />
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-colors ${
                    selectedPurposeId === purpose.id 
                      ? 'border-blue-600' 
                      : 'border-slate-300'
                  }`}>
                    {selectedPurposeId === purpose.id && (
                      <div className="w-3 h-3 bg-blue-600 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="block text-lg font-medium text-slate-900">{purpose.label}</span>
                    {purpose.description && (
                      <span className="block text-sm text-slate-500 mt-0.5">{purpose.description}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setStep('LOCATION')}
                className="px-6 py-4 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={handlePurposeSubmit}
                disabled={isLoading || !selectedPurposeId}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="animate-pulse">{loadingStatus}</span>
                  </>
                ) : (
                  <>
                    <span>Find Requirements</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {step === 'LOCATION' && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm text-slate-500">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center">
             <div className="p-2 bg-blue-50 rounded-lg text-blue-600 mb-2">
               <Globe className="w-5 h-5" />
             </div>
            <span className="block font-semibold text-slate-700 mb-1">Up-to-date Info</span>
            Latest policies & timelines
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center">
             <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mb-2">
               <ListChecks className="w-5 h-5" />
             </div>
            <span className="block font-semibold text-slate-700 mb-1">Smart Checklists</span>
            Personalized requirements
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center">
             <div className="p-2 bg-purple-50 rounded-lg text-purple-600 mb-2">
               <Sparkles className="w-5 h-5" />
             </div>
            <span className="block font-semibold text-slate-700 mb-1">Document AI</span>
            Cover letters & Itineraries
          </div>
        </div>
      )}
    </div>
  );
};