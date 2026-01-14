<?php

declare(strict_types=1);

$pdo = new PDO('sqlite:' . DB_PATH);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
    );'
);

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
    );'
);

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (quote_id) REFERENCES quotes(id)
    );'
);

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        paid_at TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id)
    );'
);

$chefPassword = password_hash('chef123', PASSWORD_DEFAULT);
$employeePassword = password_hash('employe123', PASSWORD_DEFAULT);

$statement = $pdo->prepare('SELECT COUNT(*) FROM users');
$statement->execute();
$usersCount = (int) $statement->fetchColumn();

if ($usersCount === 0) {
    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?);'
    );
    $insert->execute(['Chef Entreprise', 'chef@example.com', $chefPassword, 'chef']);
    $insert->execute(['Employé Standard', 'employe@example.com', $employeePassword, 'employe']);
}
