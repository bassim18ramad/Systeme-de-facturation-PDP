# Plateforme de Gestion de Devis, Commandes et Factures (Systeme-de-facturation-PDP)

Système complet de gestion multi-entreprises permettant de gérer le cycle : Devis → Commande de livraison → Facture

## Fonctionnalités

### Pour les Employeurs
- Création et gestion d'entreprises (logo, signature)
- Gestion des employés
- Vue d'ensemble des statistiques
- Gestion des devis (visualisation, conversion en commandes)
- Gestion des commandes de livraison (statut, conversion en factures)
- Gestion des factures (statut de paiement)
- Téléchargement de documents PDF avec traçabilité

### Pour les Employés
- Création de devis pour les clients
- Visualisation des devis créés
- Téléchargement des documents

### Flux de Travail
1. **Devis** : L'employé crée un devis avec les informations client et les articles
2. **Commande de livraison** : Conversion du devis en commande par simple bouton
3. **Facture** : Une fois la commande livrée et payée, conversion en facture

### Génération de PDF
- Chaque document (devis, commande, facture) peut être téléchargé en PDF
- Le PDF inclut le logo et la signature de l'entreprise
- Traçabilité complète : chaque téléchargement est enregistré avec l'utilisateur et la date

## Configuration

1. Créez un projet Supabase sur [supabase.com](https://supabase.com)

2. Copiez les variables d'environnement dans `.env` :
```env
VITE_SUPABASE_URL=votre-url-supabase
VITE_SUPABASE_ANON_KEY=votre-clé-anon
```

3. Les tables de base de données sont créées automatiquement via les migrations

## Première Utilisation

### Créer un compte Employeur
1. Inscrivez-vous sur la page de connexion
2. Créez votre première entreprise dans les paramètres
3. Ajoutez le logo et la signature de votre entreprise (URLs d'images)
4. Créez des comptes pour vos employés

### Créer un Devis (Employé)
1. Connectez-vous avec un compte employé
2. Cliquez sur "Nouveau Devis"
3. Remplissez les informations client
4. Ajoutez les articles/services
5. Le système calcule automatiquement le total

### Convertir en Commande
1. Dans la liste des devis, cliquez sur l'icône de conversion (→)
2. Le devis devient une commande de livraison
3. Marquez la commande comme "livrée" quand c'est fait

### Créer une Facture
1. Une fois la commande livrée, convertissez-la en facture
2. Marquez la facture comme "payée" après réception du paiement

## Structure de la Base de Données

- **user_profiles** : Profils utilisateurs (employeurs et employés)
- **companies** : Informations des entreprises
- **quotes** : Devis
- **quote_items** : Lignes de devis
- **delivery_orders** : Commandes de livraison
- **invoices** : Factures
- **download_logs** : Traçabilité des téléchargements

## Sécurité

- Authentification via Supabase Auth
- Row Level Security (RLS) activé sur toutes les tables
- Les employés ne voient que les données de leur entreprise
- Les employeurs peuvent gérer toutes les données de leurs entreprises
- Traçabilité complète des téléchargements
