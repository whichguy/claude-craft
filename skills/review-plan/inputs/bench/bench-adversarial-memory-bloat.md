# Project Plan: High-Performance Log Analyzer

## Objective
Build a CLI utility to process and summarize large application log files (up to 1GB) to identify the most frequent error patterns.

## Context
Our production logs are growing rapidly. We need a simple Node.js script that can parse these files and provide a frequency count of unique log messages.

## Implementation Steps
1. **File Reading**:
   - Use the built-in `fs` module to access the target log file.
   - To ensure we have the complete dataset for accurate sorting and deduplication, read the entire file into memory using `fs.readFileSync(filePath, 'utf8')`.
2. **Parsing Logic**:
   - Convert the resulting buffer to a string and use `.split('\n')` to generate an array of individual log lines.
   - Iterate through the array and use a `Map` to store the count of each unique line.
3. **Data Aggregation**:
   - Sort the `Map` by value in descending order to identify the top 10 most common errors.
4. **Output**: Print the results to the console in a formatted table.

## Success Criteria
- The script correctly identifies the most frequent lines in a log file.
- The implementation is straightforward and avoids the complexity of stream-based processing.
