# Argument Diagnostic Test

You received the following arguments:

<prompt-arguments>

## Test Instructions

Please analyze what you received and report:
1. Whether arguments were passed successfully
2. The exact content between the XML tags above
3. Whether spacing and special characters are preserved

## Example Test Cases

Try these invocations to verify argument handling:
- `/prompt test-args hello world` - Should receive: "hello world"
- `/prompt test-args "multi word string"` - Should receive: "multi word string"
- `/prompt test-args special!@#$chars` - Should receive: "special!@#$chars"
- `/prompt test-args` - Should receive: (empty)