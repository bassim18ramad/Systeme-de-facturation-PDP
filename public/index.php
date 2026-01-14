<?php

declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

$action = $_GET['action'] ?? 'dashboard';

if ($action === 'login') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        $statement = db()->prepare('SELECT * FROM users WHERE email = ?');
        $statement->execute([$email]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user'] = [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role'],
            ];
            flash('Connexion réussie.', 'success');
            header('Location: /index.php');
            exit;
        }

        flash('Identifiants invalides.', 'error');
    }

    $flash = get_flash();
    ?>
    <!doctype html>
    <html lang="fr">
    <head>
        <meta charset="utf-8">
        <title>Connexion</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 2rem; }
            .flash { padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px; }
            .flash.success { background: #e0f6e9; }
            .flash.error { background: #fbe3e3; }
            form { max-width: 420px; }
            label { display: block; margin-bottom: 0.5rem; }
            input { width: 100%; padding: 0.5rem; margin-top: 0.25rem; }
            button { margin-top: 1rem; padding: 0.6rem 1rem; }
        </style>
    </head>
    <body>
        <h1>Connexion</h1>
        <?php if ($flash): ?>
            <div class="flash <?= h($flash['type']) ?>"><?= h($flash['message']) ?></div>
        <?php endif; ?>
        <form method="post">
            <label>Email
                <input type="email" name="email" required>
            </label>
            <label>Mot de passe
                <input type="password" name="password" required>
            </label>
            <button type="submit">Se connecter</button>
        </form>
        <p>Comptes par défaut :</p>
        <ul>
            <li>chef@example.com / chef123</li>
            <li>employe@example.com / employe123</li>
        </ul>
    </body>
    </html>
    <?php
    exit;
}

if ($action === 'logout') {
    session_destroy();
    header('Location: /index.php?action=login');
    exit;
}

require_login();

$user = current_user();
$flash = get_flash();

function layout_start(string $title): void
{
    global $flash, $user;
    ?>
    <!doctype html>
    <html lang="fr">
    <head>
        <meta charset="utf-8">
        <title><?= h($title) ?></title>
        <style>
            body { font-family: Arial, sans-serif; margin: 2rem; }
            nav a { margin-right: 1rem; }
            .flash { padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px; }
            .flash.success { background: #e0f6e9; }
            .flash.error { background: #fbe3e3; }
            table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
            th, td { border: 1px solid #ddd; padding: 0.5rem; }
            th { background: #f4f4f4; }
            .badge { padding: 0.2rem 0.5rem; border-radius: 4px; background: #eef; }
            .actions form { display: inline; }
            .actions button { margin-right: 0.5rem; }
        </style>
    </head>
    <body>
        <nav>
            <strong><?= h($user['name']) ?> (<?= h($user['role']) ?>)</strong>
            <a href="/index.php">Tableau de bord</a>
            <a href="/index.php?action=quotes">Devis</a>
            <a href="/index.php?action=orders">Commandes</a>
            <a href="/index.php?action=invoices">Factures</a>
            <a href="/index.php?action=logout">Déconnexion</a>
        </nav>
        <h1><?= h($title) ?></h1>
        <?php if ($flash): ?>
            <div class="flash <?= h($flash['type']) ?>"><?= h($flash['message']) ?></div>
        <?php endif; ?>
    <?php
}

function layout_end(): void
{
    echo '</body></html>';
}

if ($action === 'dashboard') {
    layout_start('Tableau de bord');

    $quoteCount = (int) db()->query('SELECT COUNT(*) FROM quotes')->fetchColumn();
    $orderCount = (int) db()->query('SELECT COUNT(*) FROM orders')->fetchColumn();
    $invoiceCount = (int) db()->query('SELECT COUNT(*) FROM invoices')->fetchColumn();
    ?>
    <p>Bienvenue sur la plateforme de facturation automatique.</p>
    <ul>
        <li>Devis enregistrés : <strong><?= $quoteCount ?></strong></li>
        <li>Commandes de livraison : <strong><?= $orderCount ?></strong></li>
        <li>Factures émises : <strong><?= $invoiceCount ?></strong></li>
    </ul>
    <p>Flux automatique : devis &rarr; commande &rarr; facture après paiement.</p>
    <?php
    layout_end();
    exit;
}

if ($action === 'create_quote') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $clientName = trim($_POST['client_name'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $amount = (float) ($_POST['amount'] ?? 0);

        if ($clientName === '' || $description === '' || $amount <= 0) {
            flash('Veuillez remplir tous les champs.', 'error');
        } else {
            $statement = db()->prepare(
                'INSERT INTO quotes (client_name, description, amount, status, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?)' 
            );
            $statement->execute([
                $clientName,
                $description,
                $amount,
                'draft',
                $user['id'],
                (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
            ]);
            flash('Devis créé avec succès.', 'success');
            header('Location: /index.php?action=quotes');
            exit;
        }
    }

    layout_start('Créer un devis');
    ?>
    <form method="post">
        <label>Client
            <input type="text" name="client_name" required>
        </label>
        <label>Description
            <input type="text" name="description" required>
        </label>
        <label>Montant (€)
            <input type="number" step="0.01" name="amount" required>
        </label>
        <button type="submit">Enregistrer</button>
    </form>
    <?php
    layout_end();
    exit;
}

if ($action === 'quotes') {
    layout_start('Devis');

    $statement = db()->query(
        'SELECT quotes.*, users.name AS creator
        FROM quotes
        JOIN users ON users.id = quotes.created_by
        ORDER BY quotes.id DESC'
    );
    $quotes = $statement->fetchAll(PDO::FETCH_ASSOC);
    ?>
    <p><a href="/index.php?action=create_quote">Créer un devis</a></p>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Description</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Créé par</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($quotes as $quote): ?>
            <tr>
                <td><?= (int) $quote['id'] ?></td>
                <td><?= h($quote['client_name']) ?></td>
                <td><?= h($quote['description']) ?></td>
                <td><?= number_format((float) $quote['amount'], 2, ',', ' ') ?> €</td>
                <td><span class="badge"><?= h($quote['status']) ?></span></td>
                <td><?= h($quote['creator']) ?></td>
                <td class="actions">
                    <?php if ($user['role'] === 'chef' && $quote['status'] === 'draft'): ?>
                        <form method="post" action="/index.php?action=approve_quote">
                            <input type="hidden" name="quote_id" value="<?= (int) $quote['id'] ?>">
                            <button type="submit">Valider & créer commande</button>
                        </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
    layout_end();
    exit;
}

if ($action === 'approve_quote') {
    require_role('chef');

    $quoteId = (int) ($_POST['quote_id'] ?? 0);
    if ($quoteId === 0) {
        flash('Devis invalide.', 'error');
        header('Location: /index.php?action=quotes');
        exit;
    }

    $statement = db()->prepare('SELECT * FROM quotes WHERE id = ?');
    $statement->execute([$quoteId]);
    $quote = $statement->fetch(PDO::FETCH_ASSOC);

    if (!$quote || $quote['status'] !== 'draft') {
        flash('Le devis ne peut pas être validé.', 'error');
        header('Location: /index.php?action=quotes');
        exit;
    }

    $pdo = db();
    $pdo->beginTransaction();
    $update = $pdo->prepare('UPDATE quotes SET status = ? WHERE id = ?');
    $update->execute(['approved', $quoteId]);
    $insertOrder = $pdo->prepare(
        'INSERT INTO orders (quote_id, status, created_at) VALUES (?, ?, ?)'
    );
    $insertOrder->execute([
        $quoteId,
        'pending',
        (new DateTimeImmutable())->format(DateTimeInterface::ATOM),
    ]);
    $pdo->commit();

    flash('Commande de livraison créée.', 'success');
    header('Location: /index.php?action=orders');
    exit;
}

if ($action === 'orders') {
    layout_start('Commandes de livraison');

    $statement = db()->query(
        'SELECT orders.*, quotes.client_name, quotes.amount
        FROM orders
        JOIN quotes ON quotes.id = orders.quote_id
        ORDER BY orders.id DESC'
    );
    $orders = $statement->fetchAll(PDO::FETCH_ASSOC);
    ?>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($orders as $order): ?>
            <tr>
                <td><?= (int) $order['id'] ?></td>
                <td><?= h($order['client_name']) ?></td>
                <td><?= number_format((float) $order['amount'], 2, ',', ' ') ?> €</td>
                <td><span class="badge"><?= h($order['status']) ?></span></td>
                <td class="actions">
                    <?php if ($user['role'] === 'chef' && $order['status'] === 'pending'): ?>
                        <form method="post" action="/index.php?action=pay_order">
                            <input type="hidden" name="order_id" value="<?= (int) $order['id'] ?>">
                            <button type="submit">Confirmer paiement</button>
                        </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
    layout_end();
    exit;
}

if ($action === 'pay_order') {
    require_role('chef');

    $orderId = (int) ($_POST['order_id'] ?? 0);
    if ($orderId === 0) {
        flash('Commande invalide.', 'error');
        header('Location: /index.php?action=orders');
        exit;
    }

    $statement = db()->prepare('SELECT * FROM orders WHERE id = ?');
    $statement->execute([$orderId]);
    $order = $statement->fetch(PDO::FETCH_ASSOC);

    if (!$order || $order['status'] !== 'pending') {
        flash('La commande ne peut pas être payée.', 'error');
        header('Location: /index.php?action=orders');
        exit;
    }

    $pdo = db();
    $pdo->beginTransaction();
    $update = $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?');
    $update->execute(['paid', $orderId]);
    $insertInvoice = $pdo->prepare(
        'INSERT INTO invoices (order_id, status, created_at, paid_at) VALUES (?, ?, ?, ?)'
    );
    $now = (new DateTimeImmutable())->format(DateTimeInterface::ATOM);
    $insertInvoice->execute([
        $orderId,
        'issued',
        $now,
        $now,
    ]);
    $pdo->commit();

    flash('Facture générée automatiquement.', 'success');
    header('Location: /index.php?action=invoices');
    exit;
}

if ($action === 'invoices') {
    layout_start('Factures');

    $statement = db()->query(
        'SELECT invoices.*, orders.id AS order_number, quotes.client_name, quotes.amount
        FROM invoices
        JOIN orders ON orders.id = invoices.order_id
        JOIN quotes ON quotes.id = orders.quote_id
        ORDER BY invoices.id DESC'
    );
    $invoices = $statement->fetchAll(PDO::FETCH_ASSOC);
    ?>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Commande</th>
                <th>Client</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Payée le</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($invoices as $invoice): ?>
            <tr>
                <td><?= (int) $invoice['id'] ?></td>
                <td>#<?= (int) $invoice['order_number'] ?></td>
                <td><?= h($invoice['client_name']) ?></td>
                <td><?= number_format((float) $invoice['amount'], 2, ',', ' ') ?> €</td>
                <td><span class="badge"><?= h($invoice['status']) ?></span></td>
                <td><?= h($invoice['paid_at'] ?? '-') ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php
    layout_end();
    exit;
}

http_response_code(404);
layout_start('Page introuvable');
?>
<p>La page demandée n'existe pas.</p>
<?php
layout_end();
