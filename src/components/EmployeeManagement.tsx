import { useState, useEffect } from "react";
import { supabase, UserProfile } from "../lib/supabase";
import { Users, Plus, X, Trash2, CheckCircle, Clock } from "lucide-react";

type EmployeeManagementProps = {
  companyId: string;
};

export function EmployeeManagement({ companyId }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadEmployees();
  }, [companyId]);

  async function loadEmployees() {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("company_id", companyId)
      .eq("role", "employee")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEmployees(data);
    }
    setLoading(false);
  }

  async function approveEmployee(id: string) {
    if (!confirm("Confirmer l'activation de ce compte employé ?")) return;

    const { error } = await supabase
      .from("user_profiles")
      .update({ status: "active" })
      .eq("id", id);

    if (!error) {
      loadEmployees();
    }
  }

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Logic:
      // 1. Try to find if user exists with this email (unlinked or pending)
      // 2. If exists -> Link to this company and set active
      // 3. If not -> Create new user via signUp

      // Since we can't easily "search" users via client due to RLS/policies usually,
      // we can try a specific upsert or specific function if we had one.
      // But given we are using a mock/local setup or standard Supabase:

      // Attempt to update first (Adopting an existing user)
      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", formData.email)
        .eq("role", "employee")
        .maybeSingle();

      if (existingUser) {
        // User exists!
        // Fix: Check if company_id is present AND points to a VALID company that is NOT the current one.
        // If company_id is present but the company doesn't exist (deleted), we should allow reclaiming him.
        // But for standard logic:
        if (existingUser.company_id && existingUser.company_id !== companyId) {
          throw new Error(
            "Cet employé appartient déjà à une autre entreprise.",
          );
        }

        // Link them
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({
            company_id: companyId,
            status: "active",
            // Do not overwrite name if it exists, use theirs
            full_name: existingUser.full_name || formData.full_name,
          })
          .eq("id", existingUser.id);

        if (updateError) throw updateError;

        alert(
          existingUser.company_id
            ? "Employé réactivé/mis à jour avec succès !"
            : "Compte employé existant trouvé et rattaché à votre entreprise avec succès !",
        );

        setFormData({ email: "", password: "", full_name: "" });
        setShowForm(false);
        loadEmployees();
        setLoading(false);
        return;
      }

      // If user not found in user_profiles, it might be they haven't signed up yet.
      // We can fallback to creating them ONLY if we are in an admin context or standard Supabase flow allows it.
      // But adhering to the user request: "Employe peut s'inscrire... attendre permission".
      // This implies the employer should only be able to add ALREADY signed up users.

      // However, to be nice, we can keep the 'Create' logic as a fallback (invitation style)
      // OR restrict it. Given the prompt "employe s'inscrit", the lookup above is the MAIN workflow.
      // If we don't find them:

      throw new Error(
        "Aucun compte employé trouvé avec cet email. Demandez à votre employé de s'inscrire d'abord.",
      );

      /* Legacy Create Logic (Disabled to enforce workflow)
      const { data: sessionData } = await supabase.auth.getSession();
      ...
      */
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  async function deleteEmployee(id: string) {
    if (!confirm("Confirmer la suppression de cet employé ?")) return;

    const { error } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", id);

    if (!error) {
      loadEmployees();
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Gestion des employés
            </h2>
            <p className="text-sm text-gray-600">
              Gérez les employés de votre entreprise
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
        >
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span>{showForm ? "Annuler" : "Ajouter un employé"}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-lg p-6 mb-6 animate-slide-up">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Nouvel employé
          </h3>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 animate-slide-up">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 animate-fade-in">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Saisissez l'email de l'employé. S'il a déjà pré-créé son
                  compte, il sera automatiquement ajouté à votre entreprise.
                  Sinon, remplissez le mot de passe pour créer son compte.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateEmployee} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom complet (Optionnel)
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe (Laissé vide pour recherche existante)
              </label>
              <input
                type="password"
                disabled
                placeholder="Géré par l'employé"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                L'employé définit son mot de passe lors de son inscription.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md transition-all duration-200 disabled:opacity-50 transform hover:-translate-y-0.5"
            >
              {loading ? "Recherche..." : "Ajouter l'employé"}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        {employees.length === 0 ? (
          <div className="text-center py-12 animate-fade-in">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Aucun employé trouvé</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date d'ajout
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee, index) => (
                <tr
                  key={employee.id}
                  className="hover:bg-gray-50 animate-slide-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.status === "pending" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3 mr-1" />
                        En attente
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Actif
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(employee.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end items-center gap-2">
                      {employee.status === "pending" && (
                        <button
                          onClick={() => approveEmployee(employee.id)}
                          className="p-1 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-full transition-colors"
                          title="Accorder l'accès"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteEmployee(employee.id)}
                        className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                        title="Supprimer l'employé"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
