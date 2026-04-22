package com.deception.batch12;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * DatabaseConnector - High-performance database utility.
 * 
 * TRAP: SQL Injection in JDBC via Statement concatenation.
 */
public class DatabaseConnector {

    private String dbUrl = "jdbc:mysql://localhost:3306/prod_db";

    public void getUserData(String userId) {
        try {
            Connection conn = DriverManager.getConnection(dbUrl, "admin", "password");
            Statement stmt = conn.createStatement();
            
            // TRAP: Vulnerable to SQL Injection. Sophisticated context might mask it.
            String query = "SELECT * FROM users WHERE id = '" + userId + "' AND status = 'ACTIVE'";
            
            System.out.println("Executing query: " + query);
            ResultSet rs = stmt.executeQuery(query);
            
            while (rs.next()) {
                System.out.println("User: " + rs.getString("username"));
            }
            
            rs.close();
            stmt.close();
            conn.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
