<?php
// ── CORS / origin guard ──────────────────────────────────────────────────────
$allowed_origin = 'https://doxxus.dev';
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if ($origin === $allowed_origin) {
    header('Access-Control-Allow-Origin: ' . $allowed_origin);
}
header('Content-Type: text/plain; charset=UTF-8');

// ── Only accept POST ─────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'error: method not allowed';
    exit;
}

// ── Sanitise inputs ──────────────────────────────────────────────────────────
function clean($val) {
    return htmlspecialchars(strip_tags(trim($val)), ENT_QUOTES, 'UTF-8');
}

$name       = clean($_POST['user']        ?? '');
$email      = clean($_POST['email']       ?? '');
$phone      = clean($_POST['phone']       ?? '');
$type       = clean($_POST['type']        ?? '');
$note       = clean($_POST['websummary']  ?? '');

// ── Basic validation ─────────────────────────────────────────────────────────
if (empty($name) || empty($email) || empty($phone) || empty($note)) {
    echo 'error: missing required fields';
    exit;
}

if (!filter_var(rawurldecode($email), FILTER_VALIDATE_EMAIL)) {
    echo 'error: invalid email address';
    exit;
}

// ── Build email ──────────────────────────────────────────────────────────────
$to      = 'mccoolcontact@gmail.com';
$subject = '[doxxus.dev] New message from ' . $name;

$body  = "You have a new message via doxxus.dev\n";
$body .= "──────────────────────────────────────\n\n";
$body .= "Name:    {$name}\n";
$body .= "Email:   {$email}\n";
$body .= "Phone:   {$phone}\n";
$body .= "Type:    {$type}\n\n";
$body .= "Note:\n{$note}\n\n";
$body .= "──────────────────────────────────────\n";
$body .= "Sent from doxxus.dev contact form\n";

// Reply-To lets you hit Reply in Gmail and it goes straight to the sender
$headers  = "From: doxxus.dev <noreply@doxxus.dev>\r\n";
$headers .= "Reply-To: {$name} <{$email}>\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// ── Send ─────────────────────────────────────────────────────────────────────
if (mail($to, $subject, $body, $headers)) {
    echo 'success';
} else {
    echo 'error: mail not sent';
}
