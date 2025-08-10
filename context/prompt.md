# Motion MCP Development Task Prompt Template

  I need you to implement [TASK NAME/NUMBER] from the Motion MCP Server project.

  ## Instructions

  1. **Load Context** - Read files in this exact order:
     - `/context/project.md` - Project overview
     - `/context/conventions.md` - How we work
     - `/context/working-state.md` - Current state
     - `/context/tasks/current/[TASK-FILE].md` - Your specific task

  2. **Plan Your Approach** - Use mcp__zen__thinkdeep (model: gemini-2.5-pro) to analyze the task and create an implementation plan

  3. **Follow CLAUDE.md** - The project's Claude-specific instructions override defaults

  4. **Track Progress** - Use TodoWrite to break down the task into subtasks

  5. **Code Review** - Use mcp__zen__codereview before completing

  6. **Update State** - Follow the task lifecycle in conventions.md

  ## Key Reminders
  - Create feature branch BEFORE any code changes (see conventions.md)
  - Check task dependencies in working-state.md
  - Tool count must stay under 100 (MCP limitation)
  - All Motion operations need workspace context

  ## For Complex Tasks
  Consider using specialized agents:
  - API Implementation (2.x, 3.x): Use Task tool with general-purpose agent
  - Refactoring (0.1, 0.2, 1.1): Use mcp__zen__refactor
  - Documentation (5.1): Use mcp__zen__docgen

  Additional context: [Specific requirements or blockers]
