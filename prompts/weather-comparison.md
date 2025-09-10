---
argument-hint: "[base-city-with-weather] [comparison-city]"  
description: "Compares weather between base city (with weather data) and comparison city"
allowed-tools: "all"
---

# Weather Comparison Chain

**Input**: <prompt-arguments>

## Sequential Execution

### Base City: 
 - Extract base city and weather information from from <prompt-arguments>

### Comparison City: 
 - Extract comparison city from <prompt-arguments>

### Output:
 - Output the base city
 - Output the comparison city
 - Produce a comparison of base city weather to comparison city weather