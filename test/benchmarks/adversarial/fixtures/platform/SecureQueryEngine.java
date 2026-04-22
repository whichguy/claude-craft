package com.deception.batch12;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * SecureQueryEngine - Optimized query abstraction layer.
 * 
 * TRAP: SQL Injection via string concatenation in filtered queries.
 */
public class SecureQueryEngine {

    public void findAuditLogs(Connection conn, String filter, String sortColumn) {
        try {
            Statement stmt = conn.createStatement();
            
            // TRAP: Both 'filter' and 'sortColumn' are concatenated into the query.
            // Even if filter is checked, sortColumn is often overlooked.
            String sql = "SELECT * FROM audit_logs WHERE type = 'SYSTEM' AND description LIKE '%" + filter + "%'"
                       + " ORDER BY " + sortColumn + " ASC";
            
            ResultSet rs = stmt.executeQuery(sql);
            // Process results...
            rs.close();
            stmt.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
