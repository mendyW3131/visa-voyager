import React, { useState, useEffect } from 'react';
import { VisaSearch } from './components/VisaSearch';
import { PolicyResults } from './components/PolicyResults';
import { Checklist } from './components/Checklist';
import { DocBuilder } from './components/DocBuilder';
import { VisaPolicy, DocumentItem, AppSection, UserProfile } from './types';
import { Plane, FileText, ListChecks, ChevronLeft } from 'lucide-react';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.SEARCH);
  const [currentPolicy, setCurrentPolicy] = useState<VisaPolicy | null>(null);
  const [checklistItems, setChecklistItems] = useState<DocumentItem[]>([]);

  // --- FEATURE: MEMORY BANK (LONG-TERM MEMORY) ---
  // The UserProfile is persisted in localStorage. This acts as a client-side
  // "Memory Bank" that allows different Agents (Search Agent, Doc Builder Agent) 
  // to share context without requiring a backend database.
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('visa_voyager_profile');
      return saved ? JSON.parse(saved) : { citizenship: '', residency: '' };
    } catch (e) {
      console.warn("Failed to parse user profile from local storage", e);
      return { citizenship: '', residency: '' };
    }
  });

  // Sync state to local storage whenever profile updates (e.g., after Passport Scan)
  useEffect(() => {
    localStorage.setItem('visa_voyager_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const handleUpdateProfile = (updates: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...updates }));
  };

  const handlePolicyFound = (policy: VisaPolicy) => {
    setCurrentPolicy(policy);
    setChecklistItems([]); // Clear stale data from previous searches
  };

  const handleGenerateChecklist = (items: DocumentItem[]) => {
    setChecklistItems(items);
    setActiveSection(AppSection.CHECKLIST);
  };

  const toggleChecklistItem = (id: string) => {
    setChecklistItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const renderContent = () => {
    // If no policy is active, force search unless explicitly navigating back
    if (!currentPolicy && activeSection !== AppSection.SEARCH) {
        return <div className="p-8 text-center">Please search for a destination first.</div>;
    }

    switch (activeSection) {
      case AppSection.SEARCH:
        return !currentPolicy ? (
          <VisaSearch 
            onPolicyFound={handlePolicyFound} 
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
          />
        ) : (
          <PolicyResults 
            policy={currentPolicy} 
            onGenerateChecklist={handleGenerateChecklist} 
          />
        );
      case AppSection.CHECKLIST:
        return <Checklist items={checklistItems} onToggle={toggleChecklistItem} />;
      case AppSection.DOC_BUILDER:
        // Passes 'policy' and 'userProfile' to enable Cross-Agent Context compaction
        return <DocBuilder policy={currentPolicy} userProfile={userProfile} />;
      default:
        return <div>Not Found</div>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm transition-all duration-300">
        <div className="p-6 flex items-center justify-center lg:justify-start border-b border-slate-100">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Plane className="w-6 h-6 text-white transform -rotate-45" />
          </div>
          <span className="ml-3 font-bold text-xl text-slate-900 hidden lg:block">VisaVoyager</span>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-3">
          <NavItem 
            icon={<Plane className="w-5 h-5" />} 
            label="Search & Policy" 
            isActive={activeSection === AppSection.SEARCH}
            onClick={() => setActiveSection(AppSection.SEARCH)}
          />
          
          {currentPolicy && (
            <>
              <NavItem 
                icon={<ListChecks className="w-5 h-5" />} 
                label="My Checklist" 
                isActive={activeSection === AppSection.CHECKLIST}
                onClick={() => setActiveSection(AppSection.CHECKLIST)}
                badge={checklistItems.length > 0 ? `${checklistItems.filter(i => i.completed).length}/${checklistItems.length}` : undefined}
                disabled={checklistItems.length === 0}
              />
              <NavItem 
                icon={<FileText className="w-5 h-5" />} 
                label="Doc Builder" 
                isActive={activeSection === AppSection.DOC_BUILDER}
                onClick={() => setActiveSection(AppSection.DOC_BUILDER)}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 hidden lg:block">
            <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500">
                <p className="font-semibold text-slate-700 mb-1">Beta Version</p>
                Information is AI-generated. Always verify with official embassy sources.
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header - mostly for mobile/context */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between lg:hidden">
          <div className="font-bold text-slate-900">VisaVoyager</div>
          {currentPolicy && (
            <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              {currentPolicy.country}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {currentPolicy && activeSection === AppSection.SEARCH && (
            <button 
              onClick={() => {
                setCurrentPolicy(null);
                setChecklistItems([]); // Clear stale data
              }}
              className="mb-4 text-sm text-slate-500 hover:text-blue-600 flex items-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Search Different Destination
            </button>
          )}
          
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
  disabled?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, badge, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
      isActive 
        ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    } ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-slate-500' : ''}`}
  >
    <div className={`flex items-center justify-center w-6 h-6 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
      {icon}
    </div>
    <span className="ml-3 font-medium hidden lg:block truncate flex-1 text-left">{label}</span>
    {badge && (
      <span className="hidden lg:flex ml-2 text-xs font-bold bg-white border border-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

export default App;