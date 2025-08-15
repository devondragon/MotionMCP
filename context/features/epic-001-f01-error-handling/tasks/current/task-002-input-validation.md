# Task 4.2: Input Validation Improvements

**Priority:** Implementation Improvements (Priority 4)
**Status:** Current

**Purpose:** Catch errors early and provide better user feedback

## Implementation Details

### 1. Create `src/utils/validators.js`:

```javascript
const VALID_PRIORITIES = ['ASAP', 'HIGH', 'MEDIUM', 'LOW'];
const VALID_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELED'];
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

class Validators {
  static validatePriority(priority) {
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    return priority;
  }

  static validateStatus(status, type = 'task') {
    if (type === 'task' && status && !VALID_TASK_STATUSES.includes(status)) {
      throw new Error(`Invalid task status: ${status}. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`);
    }
    // Add project status validation when we know valid values
    return status;
  }

  static validateDate(dateString, fieldName = 'date') {
    if (!dateString) return null;
    
    if (!ISO_8601_REGEX.test(dateString)) {
      // Try to parse and convert to ISO
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid ${fieldName}: ${dateString}. Must be ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)`);
      }
      return date.toISOString();
    }
    return dateString;
  }

  static validateDuration(duration) {
    if (duration === undefined || duration === null) return null;
    
    if (duration === 'NONE' || duration === 'REMINDER') return duration;
    
    const numDuration = Number(duration);
    if (isNaN(numDuration) || numDuration < 0) {
      throw new Error(`Invalid duration: ${duration}. Must be a positive number (minutes), 'NONE', or 'REMINDER'`);
    }
    return numDuration;
  }

  static validateHexColor(color) {
    if (!color) return null;
    
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(color)) {
      throw new Error(`Invalid color: ${color}. Must be hex format (e.g., #FF5733)`);
    }
    return color;
  }

  static validateRequiredFields(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}

module.exports = Validators;
```

### 2. Apply validators in `src/mcp-server.js` handlers:

```javascript
const Validators = require('./utils/validators');

async handleCreateTask(args) {
  try {
    // Validate inputs
    Validators.validateRequiredFields(args, ['name']);
    args.priority = Validators.validatePriority(args.priority);
    args.dueDate = Validators.validateDate(args.dueDate, 'dueDate');
    args.duration = Validators.validateDuration(args.duration);
    args.status = Validators.validateStatus(args.status, 'task');
    
    // ... rest of implementation
  } catch (error) {
    return formatMcpError(error);
  }
}
```