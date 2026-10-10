<?php
/* شغّل هذا الملف مرة واحدة من المتصفح: yourdomain.com/install.php ثم احذفه فوراً */
require __DIR__ . '/config.php';
header('Content-Type: text/html; charset=utf-8');
try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec("CREATE TABLE IF NOT EXISTS " . DB_TABLE . " (
        id TINYINT PRIMARY KEY,
        rev INT NOT NULL DEFAULT 0,
        data LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS " . BACKUP_TABLE . " (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rev INT NOT NULL,
        data LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    echo '<div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:60px auto;padding:24px;border:1px solid #2e7d32;border-radius:12px;background:#e8f5e9;color:#1b5e20">'
       . '<h2>✅ تم التثبيت بنجاح</h2>'
       . '<p>تم إنشاء جدولي البيانات والنسخ الاحتياطي.</p>'
       . '<p><b>مهم:</b> احذف ملف <code>install.php</code> الآن من الاستضافة.</p>'
       . '</div>';
} catch (Exception $e) {
    http_response_code(500);
    echo '<div dir="rtl" style="font-family:sans-serif;max-width:600px;margin:60px auto;padding:24px;border:1px solid #c62828;border-radius:12px;background:#ffebee;color:#b71c1c">'
       . '<h2>❌ فشل الاتصال بقاعدة البيانات</h2><p>' . htmlspecialchars($e->getMessage()) . '</p>'
       . '<p>تأكد من بيانات <code>config.php</code> ومن إنشاء قاعدة البيانات في هوستنجر.</p></div>';
}
?>
