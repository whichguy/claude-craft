---
description: Performance analysis and optimization recommendations
allowed-tools: Read, Grep, Bash(npm:*), Bash(node:*), WebSearch
argument-hint: [component-name] or [file-pattern]
---

# Performance Analysis Command

Analyze performance characteristics and identify optimization opportunities:

## Performance Metrics

### Frontend Performance
- [ ] **Load Time**: First contentful paint, largest contentful paint
- [ ] **Bundle Size**: JavaScript and CSS bundle optimization
- [ ] **Resource Loading**: Image optimization, lazy loading
- [ ] **Rendering**: Layout shifts, reflows, repaints
- [ ] **Runtime Performance**: Frame rates, memory usage

### Backend Performance  
- [ ] **Response Time**: API endpoint response times
- [ ] **Throughput**: Requests per second capacity
- [ ] **Database Performance**: Query execution times
- [ ] **Memory Usage**: Heap utilization and garbage collection
- [ ] **CPU Usage**: Processing efficiency

### Database Optimization
- [ ] **Query Performance**: Slow query identification
- [ ] **Index Usage**: Proper indexing strategies
- [ ] **Connection Pooling**: Efficient connection management
- [ ] **Caching Strategy**: Query result caching
- [ ] **Schema Design**: Normalized vs denormalized trade-offs

### Network Performance
- [ ] **CDN Usage**: Content delivery optimization
- [ ] **Compression**: Gzip/Brotli compression
- [ ] **Caching Headers**: HTTP caching strategies
- [ ] **API Efficiency**: Payload size optimization
- [ ] **Connection Management**: Keep-alive, HTTP/2

## Analysis Tools
- **Profiling**: Chrome DevTools, Node.js profiler
- **Monitoring**: APM tools, custom metrics
- **Load Testing**: Artillery, k6, JMeter
- **Bundle Analysis**: Webpack Bundle Analyzer
- **Database Tools**: EXPLAIN ANALYZE, query profilers

## Optimization Strategies
1. **Identify Bottlenecks**: Profile before optimizing
2. **Measure Impact**: Before and after comparisons
3. **Incremental Changes**: One optimization at a time
4. **Monitor Production**: Real-world performance tracking

Performance analysis target: ${1:-"entire application"}

Analyze performance for: $ARGUMENTS