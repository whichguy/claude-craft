# Debugging Strategy Template

Use this systematic approach when debugging complex issues.

## Problem Analysis

### 1. Problem Definition
- **Symptoms**: What is the observable behavior?
- **Expected**: What should happen instead?
- **Frequency**: How often does this occur?
- **Context**: When/where does it happen?

### 2. Information Gathering
- **Error Messages**: Collect all error logs and messages
- **Reproduction Steps**: Document exact steps to reproduce
- **Environment**: OS, versions, configuration details
- **Recent Changes**: What changed recently?

### 3. Hypothesis Formation
- **Primary Theory**: Most likely cause based on evidence
- **Alternative Theories**: Other possible explanations
- **Test Strategy**: How to validate each hypothesis

### 4. Investigation Tools
- **Logging**: Add strategic debug logging
- **Debugger**: Step through code execution
- **Profiling**: Performance and memory analysis
- **Network**: Request/response inspection
- **Database**: Query analysis and explain plans

### 5. Systematic Testing
- **Isolate Variables**: Change one thing at a time
- **Binary Search**: Narrow down the problem area
- **Minimal Reproduction**: Create smallest test case
- **Compare Working**: What's different from working state?

### 6. Root Cause Analysis
- **Immediate Cause**: What directly triggered the issue?
- **Contributing Factors**: What conditions enabled it?
- **Underlying Cause**: Why did the system allow this?

### 7. Solution Implementation
- **Fix Strategy**: Address root cause, not just symptoms
- **Testing**: Verify fix works and doesn't break anything else
- **Monitoring**: Add safeguards to prevent recurrence
- **Documentation**: Record findings and solution

## Common Debugging Patterns

### Performance Issues
1. Profile to identify bottlenecks
2. Check database query performance
3. Analyze memory usage patterns
4. Review algorithm complexity

### Integration Issues  
1. Verify API contracts and schemas
2. Check network connectivity and timeouts
3. Validate authentication and permissions
4. Test with different data sets

### Concurrency Issues
1. Look for race conditions
2. Check thread safety
3. Analyze deadlock potential
4. Review shared resource access