#!/usr/bin/env node

/**
 * Validation script for Motion MCP Server utilities
 * 
 * This script performs basic validation of all utility modules to ensure
 * they can be imported and their basic functionality works as expected.
 * 
 * Usage: node src/validate-utilities.js
 */

const path = require('path');

console.log('='.repeat(60));
console.log('Motion MCP Server Utilities Validation');
console.log('='.repeat(60));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    const result = testFn();
    // Handle async tests
    if (result && typeof result.then === 'function') {
      return result.then(() => {
        console.log(`✓ ${testName}`);
        passedTests++;
      }).catch(error => {
        console.log(`✗ ${testName}: ${error.message}`);
        failedTests++;
      });
    } else {
      console.log(`✓ ${testName}`);
      passedTests++;
    }
  } catch (error) {
    console.log(`✗ ${testName}: ${error.message}`);
    failedTests++;
  }
}

async function runAllTests() {
  // Run all tests (some may be async)
  const testPromises = [];
  
  // Test 1: Import utilities without errors
  testPromises.push(runTest('Import utilities module', () => {
    const utils = require('./utils');
    if (!utils) throw new Error('Utils module not exported');
    if (!utils.ERROR_CODES) throw new Error('ERROR_CODES not exported');
    if (!utils.WorkspaceResolver) throw new Error('WorkspaceResolver not exported');
  }));

  // Test 2: Constants validation
  testPromises.push(runTest('Constants validation', () => {
    const { ERROR_CODES, MCP_RESPONSE_TYPES, DEFAULTS, LOG_LEVELS } = require('./utils');
    
    // Check ERROR_CODES
    if (!ERROR_CODES.WORKSPACE_NOT_FOUND) throw new Error('Missing WORKSPACE_NOT_FOUND error code');
    if (!ERROR_CODES.INVALID_PARAMETERS) throw new Error('Missing INVALID_PARAMETERS error code');
    
    // Check MCP_RESPONSE_TYPES
    if (MCP_RESPONSE_TYPES.TEXT !== 'text') throw new Error('Invalid TEXT response type');
    
    // Check DEFAULTS
    if (DEFAULTS.SEARCH_LIMIT !== 20) throw new Error('Invalid SEARCH_LIMIT default');
    
    // Check LOG_LEVELS
    if (!LOG_LEVELS.INFO) throw new Error('Missing INFO log level');
  }));

  // Test 3: Error handling utilities
  testPromises.push(runTest('Error handling utilities', () => {
    const { MotionApiError, ValidationError, WorkspaceError, formatMcpError, formatMcpSuccess } = require('./utils');
    
    // Test error classes
    const apiError = new MotionApiError('Test error', 'TEST_CODE', { test: true });
    if (apiError.name !== 'MotionApiError') throw new Error('Invalid MotionApiError name');
    if (apiError.code !== 'TEST_CODE') throw new Error('Invalid MotionApiError code');
    
    const validationError = new ValidationError('Validation failed', 'testParam');
    if (validationError.name !== 'ValidationError') throw new Error('Invalid ValidationError name');
    if (validationError.parameter !== 'testParam') throw new Error('Invalid ValidationError parameter');
    
    const workspaceError = new WorkspaceError('Workspace error');
    if (workspaceError.name !== 'WorkspaceError') throw new Error('Invalid WorkspaceError name');
    
    // Test response formatters
    const errorResponse = formatMcpError(new Error('Test error'));
    if (!errorResponse.isError) throw new Error('Error response missing isError flag');
    if (!errorResponse.content || !errorResponse.content[0] || !errorResponse.content[0].text.includes('Test error')) {
      throw new Error('Error response missing error message');
    }
    
    const successResponse = formatMcpSuccess('Success message');
    if (successResponse.isError) throw new Error('Success response has error flag');
    if (!successResponse.content || !successResponse.content[0] || successResponse.content[0].text !== 'Success message') {
      throw new Error('Success response missing message');
    }
  }));

  // Test 4: Response formatters
  testPromises.push(runTest('Response formatters', () => {
    const { formatListResponse, formatProjectList, formatTaskList } = require('./utils');
    
    // Test formatListResponse
    const items = [{ name: 'Item 1' }, { name: 'Item 2' }];
    const listResponse = formatListResponse(items, 'Test Items', item => `- ${item.name}`);
    if (!listResponse.content || !listResponse.content[0] || !listResponse.content[0].text.includes('Test Items:')) {
      throw new Error('List response missing title');
    }
    
    // Test formatProjectList
    const projects = [{ name: 'Project 1', id: 'p1' }, { name: 'Project 2', id: 'p2' }];
    const projectResponse = formatProjectList(projects, 'Test Workspace', 'ws1');
    if (!projectResponse.content || !projectResponse.content[0] || !projectResponse.content[0].text.includes('Found 2 projects')) {
      throw new Error('Project list response missing count');
    }
    
    // Test formatTaskList
    const tasks = [{ name: 'Task 1', id: 't1', status: 'pending' }];
    const taskResponse = formatTaskList(tasks, { workspaceName: 'Test Workspace' });
    if (!taskResponse.content || !taskResponse.content[0] || !taskResponse.content[0].text.includes('Found 1 task')) {
      throw new Error('Task list response missing count');
    }
  }));

  // Test 5: Parameter utilities
  testPromises.push(runTest('Parameter utilities', () => {
    const { 
      parseWorkspaceArgs, 
      parseSearchArgs, 
      parseTaskArgs, 
      validateRequiredParams,
      validateParameterTypes,
      sanitizeStringParams
    } = require('./utils');
    
    // Test parseWorkspaceArgs
    const workspaceArgs = parseWorkspaceArgs({ workspaceId: 'ws1', workspaceName: 'Test Workspace' });
    if (workspaceArgs.workspaceId !== 'ws1') throw new Error('Failed to parse workspaceId');
    if (workspaceArgs.workspaceName !== 'Test Workspace') throw new Error('Failed to parse workspaceName');
    
    // Test parseSearchArgs
    const searchArgs = parseSearchArgs({ query: 'test', limit: 10 });
    if (searchArgs.query !== 'test') throw new Error('Failed to parse search query');
    if (searchArgs.limit !== 10) throw new Error('Failed to parse search limit');
    if (searchArgs.searchScope !== 'both') throw new Error('Failed to apply search scope default');
    
    // Test parseTaskArgs
    const taskArgs = parseTaskArgs({ name: 'Test Task', priority: 'HIGH' });
    if (taskArgs.name !== 'Test Task') throw new Error('Failed to parse task name');
    if (taskArgs.priority !== 'HIGH') throw new Error('Failed to parse task priority');
    
    // Test validateRequiredParams
    try {
      validateRequiredParams({ name: 'Test' }, ['name', 'missing']);
      throw new Error('Should have thrown validation error');
    } catch (error) {
      if (error.name !== 'ValidationError') throw new Error('Wrong error type for validation');
    }
    
    // Test validateParameterTypes
    try {
      validateParameterTypes({ limit: 'not-a-number' }, { limit: 'number' });
      throw new Error('Should have thrown type validation error');
    } catch (error) {
      if (error.name !== 'ValidationError') throw new Error('Wrong error type for type validation');
    }
    
    // Test sanitizeStringParams
    const sanitized = sanitizeStringParams({ name: '  Test  ', empty: '  ' }, ['name', 'empty']);
    if (sanitized.name !== 'Test') throw new Error('Failed to trim string');
    if (sanitized.empty !== null) throw new Error('Failed to convert empty string to null');
  }));

  // Test 6: WorkspaceResolver implementation
  testPromises.push(runTest('WorkspaceResolver implementation', () => {
    const { WorkspaceResolver } = require('./utils');
    
    // Test constructor validation
    try {
      new WorkspaceResolver();
      throw new Error('Should have thrown error for missing motionApiService');
    } catch (error) {
      if (!error.message.includes('MotionApiService is required')) {
        throw new Error('Wrong error message for missing service');
      }
    }
    
    // Create comprehensive mock service
    const mockWorkspaces = [
      { id: 'ws1', name: 'Personal Workspace', type: 'INDIVIDUAL' },
      { id: 'ws2', name: 'Team Workspace', type: 'TEAM' },
      { id: 'ws3', name: 'My Projects', type: 'INDIVIDUAL' }
    ];
    
    const mockService = {
      getWorkspaces: async () => mockWorkspaces
    };
    
    const resolver = new WorkspaceResolver(mockService);
    if (!resolver.motionService) throw new Error('MotionApiService not set');
    
    // Test method existence
    if (typeof resolver.resolveWorkspace !== 'function') throw new Error('Missing resolveWorkspace method');
    if (typeof resolver.validateWorkspaceAccess !== 'function') throw new Error('Missing validateWorkspaceAccess method');
    if (typeof resolver.getDefaultWorkspace !== 'function') throw new Error('Missing getDefaultWorkspace method');
    if (typeof resolver.getWorkspaceByName !== 'function') throw new Error('Missing getWorkspaceByName method');
  }));

  // Test 7: WorkspaceResolver functionality
  testPromises.push(runTest('WorkspaceResolver functionality', async () => {
    const { WorkspaceResolver } = require('./utils');
    
    const mockWorkspaces = [
      { id: 'ws1', name: 'Personal Workspace', type: 'INDIVIDUAL' },
      { id: 'ws2', name: 'Team Workspace', type: 'TEAM' },
      { id: 'ws3', name: 'My Projects', type: 'INDIVIDUAL' }
    ];
    
    const mockService = {
      getWorkspaces: async () => mockWorkspaces
    };
    
    const resolver = new WorkspaceResolver(mockService);
    
    // Test getDefaultWorkspace - should prefer personal workspace
    const defaultWorkspace = await resolver.getDefaultWorkspace();
    if (defaultWorkspace.name !== 'Personal Workspace') {
      throw new Error('Should have selected personal workspace as default');
    }
    
    // Test getWorkspaceByName - case insensitive
    const foundWorkspace = await resolver.getWorkspaceByName('TEAM WORKSPACE');
    if (foundWorkspace.id !== 'ws2') {
      throw new Error('Should have found workspace by name (case insensitive)');
    }
    
    // Test getWorkspaceByName - not found
    try {
      await resolver.getWorkspaceByName('Non-existent Workspace');
      throw new Error('Should have thrown error for non-existent workspace');
    } catch (error) {
      if (!error.message.includes('not found')) {
        throw new Error('Wrong error message for non-existent workspace');
      }
    }
    
    // Test validateWorkspaceAccess - valid
    const isValid = await resolver.validateWorkspaceAccess('ws1');
    if (!isValid) throw new Error('Should have validated existing workspace');
    
    // Test validateWorkspaceAccess - invalid
    try {
      await resolver.validateWorkspaceAccess('invalid-id');
      throw new Error('Should have thrown error for invalid workspace');
    } catch (error) {
      if (!error.message.includes('not accessible')) {
        throw new Error('Wrong error message for invalid workspace access');
      }
    }
    
    // Test resolveWorkspace - by ID
    const resolvedById = await resolver.resolveWorkspace({ workspaceId: 'ws2' });
    if (resolvedById.id !== 'ws2' || resolvedById.name !== 'Team Workspace') {
      throw new Error('Failed to resolve workspace by ID');
    }
    
    // Test resolveWorkspace - by name
    const resolvedByName = await resolver.resolveWorkspace({ workspaceName: 'My Projects' });
    if (resolvedByName.id !== 'ws3' || resolvedByName.name !== 'My Projects') {
      throw new Error('Failed to resolve workspace by name');
    }
    
    // Test resolveWorkspace - fallback to default
    const resolvedDefault = await resolver.resolveWorkspace({});
    if (resolvedDefault.name !== 'Personal Workspace') {
      throw new Error('Failed to fallback to default workspace');
    }
    
    // Test resolveWorkspace - no fallback
    try {
      await resolver.resolveWorkspace({}, { fallbackToDefault: false });
      throw new Error('Should have thrown error when fallback disabled');
    } catch (error) {
      if (!error.message.includes('fallback to default is disabled')) {
        throw new Error('Wrong error message for disabled fallback');
      }
    }
  }));

  // Wait for all tests to complete
  await Promise.all(testPromises.filter(p => p && typeof p.then === 'function'));
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Validation Summary:');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log('='.repeat(60));

  if (failedTests === 0) {
    console.log('✓ All utilities validation tests passed!');
    console.log('\nPhase 2 (WorkspaceResolver Implementation) is complete.');
    console.log('Next steps:');
    console.log('- Integrate WorkspaceResolver into MCP handlers');
    console.log('- Begin Phase 3: Error Handling & Response Formatting integration');
    console.log('- Test with actual Motion API calls');
    process.exit(0);
  } else {
    console.log('✗ Some utilities validation tests failed.');
    console.log('Please fix the issues before proceeding to Phase 3.');
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch(error => {
  console.error('Validation script failed:', error);
  process.exit(1);
});