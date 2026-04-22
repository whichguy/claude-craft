package com.deception.batch12;

import java.io.BufferedInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.zip.GZIPInputStream;

/**
 * StreamProcessor - Compressed data handler.
 * 
 * TRAP: Resource leak in nested stream wrappers.
 */
public class StreamProcessor {

    public void processCompressedFile(String path) throws IOException {
        // TRAP: If GZIPInputStream constructor throws, the FileInputStream is leaked.
        // Even if wrapped in try-with-resources, the nesting needs care.
        InputStream fis = new FileInputStream(path);
        InputStream bis = new BufferedInputStream(fis);
        InputStream gis = new GZIPInputStream(bis);
        
        try {
            int data = gis.read();
            while (data != -1) {
                // Process data
                data = gis.read();
            }
        } finally {
            // TRAP: Standard closing might miss the underlying fis if an error occurred during setup.
            gis.close();
        }
    }
}
