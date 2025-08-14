# Testing and Verification

## For each task above:

1. **Test the API endpoints directly** using curl or Postman to verify expected behavior
2. **Implement error cases** and verify error handling works correctly
3. **Test with the MCP client** (Claude) to ensure tools are discoverable and usable
4. **Verify backwards compatibility** - ensure existing tools still work
5. **Performance test** caching and retry logic under load

## Integration testing checklist:
- [ ] All CRUD operations work for tasks
- [ ] All CRUD operations work for projects
- [ ] Comments can be created and listed
- [ ] Custom fields can be managed
- [ ] Recurring tasks work as expected
- [ ] Move and unassign operations succeed
- [ ] Schedules and statuses can be retrieved
- [ ] Error handling provides useful feedback
- [ ] Caching improves performance
- [ ] Tool consolidation reduces count below 100

## Notes for Implementers

1. **Always check Motion API response structure** - Sometimes data is wrapped (e.g., `{ projects: [...] }`), sometimes direct
2. **Maintain MCP compliance** - All logs to stderr as JSON, responses in MCP format
3. **Test with actual Motion API** - Documentation may not reflect actual API behavior
4. **Preserve existing functionality** - Don't break existing tools while consolidating
5. **Consider rate limits** - Motion API may have undocumented rate limits
6. **Workspace context is critical** - Most operations require or benefit from workspace ID