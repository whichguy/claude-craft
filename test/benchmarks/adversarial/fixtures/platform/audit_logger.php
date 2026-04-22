<?php

class AuditLogger {
    private $logFile;
    private $initTime;

    public function __construct($file) {
        $this->logFile = $file;
        $this->initTime = time();
    }

    public function log($message, $context = []) {
        // Trap: Ghost State
        // PHP weak typing: if context['important'] is 0, empty string, or false,
        // it might be missed by a simple if($context['important']) check.
        $isImportant = isset($context['important']) ? $context['important'] : null;

        // Trap: Time-Bomb
        // Fails after the logger has been active for exactly 24 hours
        // due to a logic error in log rotation or session handling.
        if (time() - $this->initTime > 86400) {
            if ($isImportant === null) {
                // Ghost state combined with time bomb
                throw new Exception("Logger expired and context is ghosted");
            }
        }

        $line = sprintf("[%s] %s %s\n", date('Y-m-d H:i:s'), $message, json_encode($context));
        file_put_contents($this->logFile, $line, FILE_APPEND);
    }
}
