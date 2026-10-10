<?php
/* واجهة برمجية: مزامنة فورية + نسخ احتياطي تلقائي */
require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function db() {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}
function out($x) { echo json_encode($x, JSON_UNESCAPED_UNICODE); exit; }

$action = $_GET['action'] ?? '';

/* تحميل البيانات الحالية */
if ($action === 'load') {
    try {
        $row = db()->query('SELECT rev, data FROM ' . DB_TABLE . ' WHERE id = 1')->fetch();
        if (!$row) out(['ok' => true, 'rev' => 0, 'data' => null]);
        out(['ok' => true, 'rev' => (int)$row['rev'], 'data' => json_decode($row['data'], true)]);
    } catch (Exception $e) { out(['ok' => false, 'error' => 'load_failed']); }
}

/* حفظ البيانات — نسخة احتياطية فورية مع كل حفظ ناجح */
if ($action === 'save') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body) || !isset($body['data'])) out(['ok' => false, 'error' => 'bad_request']);
    $clientRev = (int)($body['rev'] ?? 0);
    $data = json_encode($body['data'], JSON_UNESCAPED_UNICODE);
    if ($data === false || strlen($data) > 40 * 1024 * 1024) out(['ok' => false, 'error' => 'data_too_large']);
    try {
        $pdo = db();
        $pdo->beginTransaction();
        $row = $pdo->query('SELECT rev, data FROM ' . DB_TABLE . ' WHERE id = 1 FOR UPDATE')->fetch();
        $serverRev = $row ? (int)$row['rev'] : 0;
        if ($row && $clientRev < $serverRev) {
            $pdo->rollBack();
            /* تعارض: جهاز آخر حفظ بعد آخر مزامنة لك — نرجع نسخة السيرفر (الأحدث) */
            out(['ok' => false, 'conflict' => true, 'rev' => $serverRev, 'data' => json_decode($row['data'], true)]);
        }
        $newRev = $serverRev + 1;
        if ($row) {
            $pdo->prepare('UPDATE ' . DB_TABLE . ' SET rev = ?, data = ? WHERE id = 1')->execute([$newRev, $data]);
        } else {
            $pdo->prepare('INSERT INTO ' . DB_TABLE . ' (id, rev, data) VALUES (1, ?, ?)')->execute([$newRev, $data]);
        }
        /* نسخة احتياطية فورية مع كل حفظ */
        $pdo->prepare('INSERT INTO ' . BACKUP_TABLE . ' (rev, data) VALUES (?, ?)')->execute([$newRev, $data]);
        $pdo->query('DELETE FROM ' . BACKUP_TABLE . ' WHERE id NOT IN (SELECT id FROM (SELECT id FROM ' . BACKUP_TABLE . ' ORDER BY id DESC LIMIT ' . (int)MAX_BACKUPS . ') t)');
        $pdo->commit();
        out(['ok' => true, 'rev' => $newRev]);
    } catch (Exception $e) {
        if (db()->inTransaction()) db()->rollBack();
        out(['ok' => false, 'error' => 'save_failed']);
    }
}

/* تنزيل أحدث نسخة احتياطية كملف JSON */
if ($action === 'download') {
    $row = db()->query('SELECT data, rev FROM ' . DB_TABLE . ' WHERE id = 1')->fetch();
    if (!$row) out(['ok' => false, 'error' => 'empty']);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="backup-rev-' . (int)$row['rev'] . '.json"');
    echo $row['data']; exit;
}

out(['ok' => false, 'error' => 'unknown_action']);
?>
