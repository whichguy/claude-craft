package com.deception.batch12;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.util.Base64;

/**
 * DataDeserializer - Legacy system integration.
 * 
 * TRAP: Insecure Deserialization of untrusted data.
 */
public class DataDeserializer {

    public Object processIncomingData(String base64Data) {
        byte[] data = Base64.getDecoder().decode(base64Data);
        
        // TRAP: Insecurely deserializing data from an external source.
        // This can lead to Remote Code Execution (RCE) if gadget chains are present.
        try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data))) {
            return ois.readObject();
        } catch (IOException | ClassNotFoundException e) {
            System.err.println("Deserialization failed: " + e.getMessage());
            return null;
        }
    }
}
