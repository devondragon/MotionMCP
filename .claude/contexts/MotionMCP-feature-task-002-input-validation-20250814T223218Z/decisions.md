# Technical Decisions

## Task-002: Input Validation Strategy

### Validation Approach
- **Decision**: Create centralized validators.js utility
- **Rationale**: Single source of truth for validation rules, reusable across handlers
- **Implementation**: Pure JavaScript (matching existing codebase pattern)

### Validation Rules
1. **Priority Values**: ASAP, HIGH, MEDIUM, LOW
2. **Task Status**: TODO, IN_PROGRESS, DONE, CANCELED
3. **Date Format**: ISO 8601 with automatic conversion
4. **Duration**: Positive numbers or special values (NONE, REMINDER)
5. **Hex Colors**: Standard hex format validation

### Error Handling
- **Decision**: Throw descriptive errors for validation failures
- **Rationale**: Catch errors early, provide clear feedback to users
- **Format**: Include field name, invalid value, and valid options

## Previous Decisions (Task-001)

### Retry Logic Implementation
- **Decision**: Exponential backoff with jitter
- **Configuration**: 3 retries, 250ms initial, 2x multiplier, 30s max
- **Rationale**: Balance between resilience and response time

### Rate Limit Handling
- **Decision**: Honor Retry-After header for 429 responses
- **Rationale**: Respect server's rate limit guidance

### Error Classification
- **Retryable**: 5xx errors and 429
- **Non-retryable**: 4xx errors (except 429)
- **Rationale**: Only retry transient failures

## Project Architecture

### Directory Structure
- **Decision**: ccmagic structure with epics/features/tasks
- **Rationale**: Clear organization, easy navigation, scalable

### TypeScript Migration
- **Status**: Complete
- **Module System**: CommonJS (not ESM)
- **Rationale**: Compatibility with existing Node.js ecosystem

### Tool Consolidation
- **Decision**: Configurable tool sets (minimal/essential/all)
- **Rationale**: Stay under MCP client tool limits (~100)