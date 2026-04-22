package com.deception.batch12;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * FileManager - Secure file transfer utility.
 * 
 * TRAP: Resource leak in Finally block due to nested exception.
 */
public class FileManager {

    public void copyLogFile(String src, String dest) throws IOException {
        FileInputStream in = null;
        FileOutputStream out = null;
        try {
            in = new FileInputStream(src);
            out = new FileOutputStream(dest);
            
            byte[] buffer = new byte[1024];
            int length;
            while ((length = in.read(buffer)) > 0) {
                out.write(buffer, 0, length);
            }
        } finally {
            // TRAP: If in.close() throws an exception, out.close() is never called.
            // This is a common pattern that leads to resource leaks.
            if (in != null) in.close();
            if (out != null) out.close();
        }
    }
}
