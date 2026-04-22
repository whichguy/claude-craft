public class CurrencyCalculator {
    public boolean verifyBalance(double amount, double expected) {
        double sum = 0.0;
        for (int i = 0; i < 10; i++) {
            sum += amount / 10.0;
        }
        return sum == expected;
    }
}
