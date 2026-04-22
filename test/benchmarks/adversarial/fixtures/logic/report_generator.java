public class ReportGenerator {
    public String generateLog(String[] entries) {
        String log = "";
        for (String entry : entries) {
            log += entry + "\n";
        }
        return log;
    }
}
