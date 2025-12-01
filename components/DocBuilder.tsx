import React, { useState, useEffect, useRef } from 'react';
import { generateVisaDocument, parsePassportImage } from '../services/gemini';
import { FileText, Loader2, Copy, Check, User, Globe, Building2, Plane, Camera, Upload } from 'lucide-react';
import { DocTemplate, VisaPolicy, UserProfile } from '../types';

interface DocBuilderProps {
  policy?: VisaPolicy | null;
  userProfile?: UserProfile;
}

export const DocBuilder: React.FC<DocBuilderProps> = ({ policy, userProfile }) => {
  const [template, setTemplate] = useState<DocTemplate>('cover-letter');
  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
    passportNumber: '',
    nationality: '',
    dateOfBirth: '',
    passportExpiry: '',
    address: '',
    email: '',
    phone: '',
    jobTitle: '',
    destination: '',
    dates: '',
    purpose: 'Tourism',
    employerName: '',
    employerAddress: '',
    startDate: '',
    salary: '',
    arrivalFlight: '',
    departureFlight: '',
    accommodation: '',
    activities: '',
  });

  // Cross-Agent Context & Memory Bank Autofill
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      // From Memory Bank
      name: userProfile?.fullName || prev.name,
      passportNumber: userProfile?.passportNumber || prev.passportNumber,
      nationality: userProfile?.citizenship || prev.nationality,
      dateOfBirth: userProfile?.dateOfBirth || prev.dateOfBirth,
      passportExpiry: userProfile?.passportExpiry || prev.passportExpiry,
      address: userProfile?.homeAddress || prev.address,
      email: userProfile?.email || prev.email,
      phone: userProfile?.phone || prev.phone,
      // From Search Agent Context
      destination: policy?.country || prev.destination,
      purpose: policy?.purpose || prev.purpose,
    }));
  }, [policy, userProfile]);

  const [generatedDoc, setGeneratedDoc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Passport Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const text = await generateVisaDocument(template, formData);
      setGeneratedDoc(text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- PASSPORT SCANNING LOGIC ---
  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        // Call Multimodal Agent
        // Pass file type (e.g. image/png) to ensure correct parsing
        const extractedData = await parsePassportImage(base64String, file.type);
        
        // Update Form
        setFormData(prev => ({
          ...prev,
          name: extractedData.fullName || prev.name,
          passportNumber: extractedData.passportNumber || prev.passportNumber,
          nationality: extractedData.citizenship || prev.nationality,
          dateOfBirth: extractedData.dateOfBirth || prev.dateOfBirth,
          passportExpiry: extractedData.passportExpiry || prev.passportExpiry
        }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not scan passport.";
      alert(message);
      console.error(error);
    } finally {
      setIsScanning(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const templates: { id: DocTemplate; label: string; icon: React.ReactNode }[] = [
    { id: 'cover-letter', label: 'Cover Letter', icon: <FileText className="w-4 h-4" /> },
    { id: 'itinerary', label: 'Travel Itinerary', icon: <Plane className="w-4 h-4" /> },
    { id: 'employment-proof', label: 'Proof of Employment', icon: <Building2 className="w-4 h-4" /> },
  ];

  const renderFormFields = () => {
    switch (template) {
      case 'cover-letter':
        return (
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center uppercase tracking-wide">
                  <User className="w-4 h-4 mr-2" /> Applicant Details
                </h4>
                {/* SCAN BUTTON */}
                <button 
                  type="button"
                  onClick={handleScanClick}
                  disabled={isScanning}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors flex items-center font-medium"
                >
                  {isScanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
                  {isScanning ? 'Scanning...' : 'Scan Passport'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} className="form-input" required />
                <input name="passportNumber" placeholder="Passport Number" value={formData.passportNumber} onChange={handleChange} className="form-input" required />
              </div>
              {/* NEW DATE FIELDS */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs text-slate-500 mb-1 ml-1">Date of Birth</label>
                    <input name="dateOfBirth" type="date" placeholder="Date of Birth" value={formData.dateOfBirth} onChange={handleChange} className="form-input" />
                 </div>
                 <div>
                    <label className="block text-xs text-slate-500 mb-1 ml-1">Passport Expiry</label>
                    <input name="passportExpiry" type="date" placeholder="Expiry Date" value={formData.passportExpiry} onChange={handleChange} className="form-input" />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} className="form-input" required />
                <input name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} className="form-input" required />
              </div>
              <input name="address" placeholder="Home Address" value={formData.address} onChange={handleChange} className="form-input" required />
              <input name="jobTitle" placeholder="Current Occupation" value={formData.jobTitle} onChange={handleChange} className="form-input" required />
            </div>
            <div className="space-y-4">
               <h4 className="text-sm font-semibold text-slate-900 flex items-center uppercase tracking-wide">
                <Globe className="w-4 h-4 mr-2" /> Trip Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <input name="destination" placeholder="Destination Country" value={formData.destination} onChange={handleChange} className="form-input" required />
                <input name="dates" placeholder="Travel Dates" value={formData.dates} onChange={handleChange} className="form-input" required />
              </div>
               <select name="purpose" value={formData.purpose} onChange={handleChange} className="form-input">
                <option value="Tourism">Tourism</option>
                <option value="Business">Business</option>
                <option value="Family Visit">Family Visit</option>
              </select>
            </div>
          </div>
        );
      case 'itinerary':
        return (
          <div className="space-y-5">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center uppercase tracking-wide">
                <User className="w-4 h-4 mr-2" /> Traveler & Dates
              </h4>
              <input name="name" placeholder="Traveler Name" value={formData.name} onChange={handleChange} className="form-input" required />
              <div className="grid grid-cols-2 gap-4">
                 <input name="destination" placeholder="Destination City/Country" value={formData.destination} onChange={handleChange} className="form-input" required />
                 <input name="dates" placeholder="Travel Dates" value={formData.dates} onChange={handleChange} className="form-input" required />
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center uppercase tracking-wide">
                <Plane className="w-4 h-4 mr-2" /> Logistics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <input name="arrivalFlight" placeholder="Arrival Flight # (Optional)" value={formData.arrivalFlight} onChange={handleChange} className="form-input" />
                <input name="departureFlight" placeholder="Departure Flight # (Optional)" value={formData.departureFlight} onChange={handleChange} className="form-input" />
              </div>
              <input name="accommodation" placeholder="Hotel Name & Address" value={formData.accommodation} onChange={handleChange} className="form-input" required />
              <textarea 
                name="activities" 
                placeholder="List key activities, cities to visit, or specific plans (e.g. Eiffel Tower, Louvre Museum, Day trip to Versailles)" 
                value={formData.activities} 
                onChange={handleChange} 
                className="form-input min-h-[100px]" 
                required 
              />
            </div>
          </div>
        );
      case 'employment-proof':
        return (
          <div className="space-y-5">
             <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center uppercase tracking-wide">
                <Building2 className="w-4 h-4 mr-2" /> Company Details
              </h4>
              <input name="employerName" placeholder="Company Name" value={formData.employerName} onChange={handleChange} className="form-input" required />
              <input name="employerAddress" placeholder="Company Address" value={formData.employerAddress} onChange={handleChange} className="form-input" required />
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center uppercase tracking-wide">
                <User className="w-4 h-4 mr-2" /> Employee Details
              </h4>
              <input name="name" placeholder="Employee Full Name" value={formData.name} onChange={handleChange} className="form-input" required />
              <div className="grid grid-cols-2 gap-4">
                <input name="jobTitle" placeholder="Job Title" value={formData.jobTitle} onChange={handleChange} className="form-input" required />
                <input name="salary" placeholder="Annual Salary" value={formData.salary} onChange={handleChange} className="form-input" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="startDate" placeholder="Employment Start Date" value={formData.startDate} onChange={handleChange} className="form-input" required />
                <input name="dates" placeholder="Requested Leave Dates" value={formData.dates} onChange={handleChange} className="form-input" required />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Hidden File Input for Passport Scan */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Left Panel - Inputs */}
      <div className="lg:w-5/12 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
           <h3 className="text-xl font-bold text-slate-800 mb-4">Document Builder</h3>
           
           <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
             {templates.map((t) => (
               <button
                key={t.id}
                onClick={() => { setTemplate(t.id); setGeneratedDoc(''); }}
                className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  template === t.id 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
               >
                 <span className="mr-2">{t.icon}</span>
                 {t.label}
               </button>
             ))}
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleGenerate}>
            {renderFormFields()}
            <div className="mt-8">
               <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center transition-all shadow-lg shadow-blue-600/20 transform hover:-translate-y-0.5"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : 'Generate Document'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="lg:w-7/12 h-full bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col relative">
        {generatedDoc ? (
          <>
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={copyToClipboard}
                className="p-2 bg-white shadow-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors flex items-center space-x-1"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                <span className="text-xs font-medium">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Document Preview</h4>
            <div className="flex-1 overflow-y-auto bg-white p-8 shadow-sm border border-slate-200 rounded-xl font-serif whitespace-pre-wrap text-slate-800 leading-relaxed text-sm">
              {generatedDoc}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="font-medium">Select a template and fill details</p>
            <p className="text-xs mt-1 text-slate-300">AI will write a professional draft for you</p>
          </div>
        )}
      </div>
      
      <style>{`
        .form-input {
          width: 100%;
          padding: 0.625rem;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          outline: none;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        .form-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
      `}</style>
    </div>
  );
};