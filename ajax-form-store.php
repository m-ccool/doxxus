<?php
/**
 * ajax-form-store.php
 * Receives POST from the contact form, sends email, echoes "success" or "error".
 * Standard PHP — works on any shared host with mail() enabled.
 */

header('Content-Type: text/plain; charset=utf-8');

// ── Config ────────────────────────────────────────────────────────────────────
$to      = 'mccoolcontact@gmail.com';
$from    = 'noreply@doxxus.dev';   // must be a domain you own / host controls
$subject = '[doxxus.dev] New Contact Form Submission';
// ─────────────────────────────────────────────────────────────────────────────

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'error';
    exit;
}

// Sanitize inputs
function clean($val) {
    return htmlspecialchars(strip_tags(trim($val)), ENT_QUOTES, 'UTF-8');
}

$type       = clean($_POST['type']       ?? '');
$name       = clean($_POST['user']       ?? '');
$email      = clean($_POST['email']      ?? '');
$phone      = clean($_POST['phone']      ?? '');
$websummary = clean($_POST['websummary'] ?? '');

// Basic required-field check
if (!$name || !$email || !$phone || !$websummary) {
    echo 'error';
    exit;
}

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo 'error';
    exit;
}

// Build email body
$body  = "New contact form submission from doxxus.dev\n";
$body .= str_repeat('-', 48) . "\n";
$body .= "Type:    $type\n";
$body .= "Name:    $name\n";
$body .= "Email:   $email\n";
$body .= "Phone:   $phone\n";
$body .= "Note:\n$websummary\n";
$body .= str_repeat('-', 48) . "\n";

// Headers
$headers  = "From: doxxus.dev <$from>\r\n";
$headers .= "Reply-To: $name <$email>\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// Send
$sent = mail($to, $subject, $body, $headers);

echo $sent ? 'success' : 'error';
