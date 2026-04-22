import Foundation

class ReportGenerator {
    var reportDate: Date
    
    init(date: Date = Date()) {
        self.reportDate = date
    }

    func generate(data: [String: Any?]) -> String {
        // Trap: Ghost State
        // Using optional chaining and nil-coalescing in a way that 
        // masks the difference between "value is nil" and "value is missing".
        let title = (data["title"] as? String) ?? "Default Report"
        
        // Trap: Time-Bomb
        // Fails on February 29th of leap years because of a hardcoded date component calculation.
        let calendar = Calendar.current
        let components = calendar.dateComponents([.month, .day], from: self.reportDate)
        
        if components.month == 2 && components.day == 29 {
            // Incorrectly assumes 28 days in Feb for offset calculation
            let nextDay = calendar.date(byAdding: .day, value: 1, to: self.reportDate)!
            if calendar.component(.day, from: nextDay) == 1 {
                // This logic is flawed and will crash or behave weirdly on leap days
                return "ERROR: INVALID_DATE_STATE"
            }
        }

        return "Report: \(title) for \(self.reportDate)"
    }
}
