def calculate_stats(numbers):
    total = 0
    for n in numbers:
        total += n
        
    # SYNTAX ERROR: Inconsistent indentation (Mix of spaces and tabs or just wrong level)
      average = total / len(numbers)
    
    # LOGIC: ZeroDivisionError if numbers is empty
    print(f"Average: {average}")

# LOGIC: Magic values and lack of exception handling
data = [10, 20, 30]
calculate_stats(data)
calculate_stats([])
