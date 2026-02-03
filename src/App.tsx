import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthForm } from "./components/AuthForm";
import { EmployerDashboard } from "./components/EmployerDashboard";
import { EmployeeDashboard } from "./components/EmployeeDashboard";
import { VerifyEmail } from "./components/VerifyEmail";

function AppContent() {
  // Check for email verification route
  if (window.location.pathname === "/verify-email") {
    return <VerifyEmail />;
  }

  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthForm />;
  }

  // Check if Employee is assigned to a company, otherwise "pending assignment"
  if (profile.role === "employee" && !profile.company_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center animate-scale-in border border-gray-100">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-6 animate-pulse-slow">
            <svg
              className="h-8 w-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Attente d'affectation
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Votre compte a été créé. Veuillez demander à votre employeur de vous
            ajouter à son entreprise en utilisant votre adresse email :
            <br />
            <strong className="text-gray-900 block mt-2">
              {profile.email}
            </strong>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Actualiser la page
          </button>
        </div>
      </div>
    );
  }

  if (profile.role === "employee" && profile.status === "pending") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Compte en attente
          </h2>
          <p className="text-gray-600 mb-6">
            Votre compte a été créé avec succès mais nécessite l'approbation de
            votre employeur avant de pouvoir accéder au tableau de bord.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Actualiser la page
          </button>
        </div>
      </div>
    );
  }

  if (profile.role === "employer") {
    return <EmployerDashboard />;
  }

  return <EmployeeDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
