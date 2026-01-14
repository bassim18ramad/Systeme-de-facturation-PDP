# Systeme-de-facturation-PDP

Plateforme PHP de facturation semi-automatique :

- Les employés enregistrent un devis.
- Le chef valide un devis pour créer une commande de livraison.
- Après paiement, la facture est générée automatiquement.

## Démarrage rapide

```bash
php -S 0.0.0.0:8000 -t public
```

Ouvrez `http://localhost:8000/index.php`.

## Comptes de démonstration

- Chef : `chef@example.com` / `chef123`
- Employé : `employe@example.com` / `employe123`

La base de données SQLite est créée automatiquement dans `data/app.db`.
