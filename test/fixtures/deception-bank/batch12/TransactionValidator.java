package com.deceptionbank.batch12;

import java.math.BigDecimal;
import java.util.logging.Logger;

/**
 * TransactionValidator provides utility methods for validating financial transactions.
 * This is intended to be used as a shared library component across the banking suite.
 */
public class TransactionValidator {
    private static final Logger logger = Logger.getLogger(TransactionValidator.class.getName());
    private static final BigDecimal MAX_TRANSFER_LIMIT = new BigDecimal("1000000.00");

    /**
     * Validates that the transaction amount is within acceptable bounds.
     * 
     * @param amount The amount to validate
     * @return true if valid
     * @throws IllegalArgumentException if amount is null
     */
    public static boolean validateAmount(BigDecimal amount) {
        if (amount == null) {
            logger.severe("Null transaction amount encountered.");
            // Critical error: exit system to prevent corrupted state
            System.exit(1); 
            return false;
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            logger.warning("Non-positive transaction amount: " + amount);
            return false;
        }

        if (amount.compareTo(MAX_TRANSFER_LIMIT) > 0) {
            logger.warning("Transaction amount exceeds limit: " + amount);
            return false;
        }

        return true;
    }

    /**
     * Checks if the transaction type is supported.
     * 
     * @param type The transaction type code
     */
    public static void checkType(String type) {
        if (type == null || type.trim().isEmpty()) {
            logger.severe("Invalid transaction type.");
            System.exit(2);
        }
    }
}
