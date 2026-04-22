import subprocess
import os

def process_log_file(filename):
    """
    Processes a log file by running a specialized compression tool.
    The filename is sanitized to prevent directory traversal.
    """
    # Sanitize: prevent directory traversal
    base_name = os.path.basename(filename)
    
    # Logic is correct for Python file path handling, 
    # but fails when crossing into the Shell domain.
    # Trap: subprocess.run with shell=True interprets shell metacharacters.
    # Even if basename() is used, filenames like "; rm -rf /" are still valid basenames.
    log_dir = "/var/log/myapp/"
    full_path = os.path.join(log_dir, base_name)
    
    print(f"Compressing {full_path}...")
    
    # CROSS-DOMAIN BUG: shell=True makes this vulnerable to injection via filename
    result = subprocess.run(f"gzip -c {full_path} > {full_path}.gz", shell=True, capture_output=True)
    
    return result.returncode == 0
