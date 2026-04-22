import sqlite3

# TRAP 1: Mutable default argument. 
# The 'active_users' list will persist across multiple calls, accumulating state unexpectedly.
def process_user_batch(user_id, role, active_users=[]):
    active_users.append(user_id)
    
    # TRAP 2: Resource leak. File opened but never closed if an exception occurs.
    # Should use 'with open(...) as f:'
    log_file = open("/tmp/audit.log", "a")
    log_file.write(f"Processing user {user_id}\n")
    
    # TRAP 3: SQL Injection. Using string formatting instead of parameterized queries.
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute(f"UPDATE users SET role = '{role}' WHERE id = '{user_id}'")
    conn.commit()
    
    log_file.close()
    return active_users
