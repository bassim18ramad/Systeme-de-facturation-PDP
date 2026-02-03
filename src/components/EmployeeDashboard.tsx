import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, Company } from "../lib/supabase";
import { LogOut, FileText, Plus } from "lucide-react";
import { QuoteForm } from "./QuoteForm";
import { QuotesList } from "./QuotesList";
import { QuoteViewer } from "./QuoteViewer";

export function EmployeeDashboard() {
  const { signOut, profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [quotesRefreshToken, setQuotesRefreshToken] = useState(0);

  useEffect(() => {
    loadCompany();
  }, [profile]);

  async function loadCompany() {
    if (!profile?.company_id) return;

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .maybeSingle();

    if (!error && data) {
      setCompany(data);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Tableau de bord Employé
                </h1>
                <p className="text-sm text-gray-500">{profile?.full_name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {company && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {company.name}
                  </p>
                </div>
              )}

              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 hover:shadow-sm rounded-lg transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {!company ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center animate-scale-in">
            <div className="bg-gray-50 h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Aucune entreprise assignée
            </h2>
            <p className="text-gray-600 max-w-sm mx-auto">
              Contactez votre employeur pour être assigné à une entreprise et
              commencer à créer des devis.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6 animate-slide-up">
              <h2 className="text-2xl font-bold text-gray-900">Mes Devis</h2>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                <span>Nouveau Devis</span>
              </button>
            </div>

            <QuotesList
              companyId={company.id}
              onUpdate={() => {}}
              refreshToken={quotesRefreshToken}
              onViewQuote={setSelectedQuote}
            />
          </>
        )}
      </main>

      {/* QuoteForm was here */}
      {showForm && company && (
        <QuoteForm
          companyId={company.id}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            setQuotesRefreshToken((token) => token + 1);
          }}
        />
      )}

      {selectedQuote && (
        <QuoteViewer
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
        />
      )}
    </div>
  );
}
