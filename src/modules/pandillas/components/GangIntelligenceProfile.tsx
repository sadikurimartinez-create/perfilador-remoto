import React, { useState } from "react";
import { GangProfile, GangMemberCandidate, ILEMemory, Evidence } from "../types";
import { GangHeader } from "./GangHeader";
import { IdentityPanel } from "./IdentityPanel";
import { OrganizationPanel } from "./OrganizationPanel";
import { IntelligencePanel } from "./IntelligencePanel";
import { IndicatorsPanel } from "./IndicatorsPanel";

interface GangIntelligenceProfileProps {
  profile: GangProfile;
  members: any[];
  candidates: GangMemberCandidate[];
  ileMemories: ILEMemory[];
  evidences: Evidence[];
  onCertifyCandidate?: (candidateId: string) => void;
  onRejectCandidate?: (candidateId: string) => void;
  onEdit?: () => void;
}

type GIPSubTab = "identidad" | "organizacion" | "inteligencia" | "indicadores";

export const GangIntelligenceProfile: React.FC<GangIntelligenceProfileProps> = ({
  profile,
  members = [],
  candidates = [],
  ileMemories = [],
  evidences = [],
  onCertifyCandidate,
  onRejectCandidate,
  onEdit
}) => {
  const [activeSubTab, setActiveSubTab] = useState<GIPSubTab>("identidad");

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case "identidad":
        return <IdentityPanel profile={profile} />;
      case "organizacion":
        return (
          <OrganizationPanel
            profile={profile}
            members={members}
            candidates={candidates}
            onCertifyCandidate={onCertifyCandidate}
            onRejectCandidate={onRejectCandidate}
          />
        );
      case "inteligencia":
        return (
          <IntelligencePanel
            profile={profile}
            ileMemories={ileMemories}
            evidences={evidences}
          />
        );
      case "indicadores":
        return <IndicatorsPanel profile={profile} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <GangHeader profile={profile} onEdit={onEdit} />

      {/* 2. Sub-tab selectors */}
      <div className="flex border-b border-slate-800 pb-1.5 gap-4 overflow-x-auto">
        {[
          { id: "identidad", label: "📖 Identidad & Modus", icon: "🎨" },
          { id: "organizacion", label: "👥 Organización & Dossier", icon: "👑" },
          { id: "inteligencia", label: "🧠 Variables & Bóveda ILE", icon: "🛡️" },
          { id: "indicadores", label: "📊 Factores & Indicadores", icon: "📈" }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as GIPSubTab)}
            className={`pb-2.5 px-1.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === t.id
                ? "border-sky-500 text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 3. Panel Content Grid */}
      <div className="animate-fadeIn transition-opacity duration-300">
        {renderSubTabContent()}
      </div>
    </div>
  );
};
