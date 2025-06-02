// Worker-compatible version of MotionApiService for Cloudflare Workers
// Uses fetch instead of axios and removes Node.js dependencies

class MotionApiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.usemotion.com/v1';

    if (!this.apiKey) {
      throw new Error('Motion API key is required');
    }
  }

  async makeRequest(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const defaultOptions = {
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Motion API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async getProjects(workspaceId = null) {
    try {
      // If no workspace ID provided, try to get the first available workspace
      if (!workspaceId) {
        try {
          const workspaces = await this.getWorkspaces();
          if (workspaces && workspaces.length > 0) {
            workspaceId = workspaces[0].id;
          }
        } catch (workspaceError) {
          // Continue without workspace filter if workspace fetch fails
        }
      }

      // Build the query string with workspace ID if available
      const params = new URLSearchParams();
      if (workspaceId) {
        params.append('workspaceId', workspaceId);
      }

      const url = `/projects${params.toString() ? '?' + params.toString() : ''}`;
      const response = await this.makeRequest(url);

      // Handle Motion API response structure - projects are wrapped in a projects array
      const projects = response.projects || response || [];
      return projects;
    } catch (error) {
      throw new Error(`Failed to fetch projects: ${error.message}`);
    }
  }

  async createProject(projectData) {
    try {
      // If no workspace ID provided, try to get the default workspace
      if (!projectData.workspaceId) {
        try {
          const defaultWorkspace = await this.getDefaultWorkspace();
          projectData = { ...projectData, workspaceId: defaultWorkspace.id };
        } catch (workspaceError) {
          // Continue without default workspace if fetch fails
        }
      }

      const response = await this.makeRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(projectData)
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  async getProject(projectId) {
    try {
      const response = await this.makeRequest(`/projects/${projectId}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to fetch project: ${error.message}`);
    }
  }

  async updateProject(projectId, projectData) {
    try {
      const response = await this.makeRequest(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(projectData)
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
  }

  async deleteProject(projectId) {
    try {
      await this.makeRequest(`/projects/${projectId}`, {
        method: 'DELETE'
      });
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  async getTasks(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.projectId) params.append('projectId', options.projectId);
      if (options.status) params.append('status', options.status);
      if (options.assigneeId) params.append('assigneeId', options.assigneeId);
      if (options.workspaceId) params.append('workspaceId', options.workspaceId);

      const response = await this.makeRequest(`/tasks?${params}`);

      // Handle Motion API response structure - tasks are wrapped in a tasks array
      const tasks = response.tasks || response || [];
      return tasks;
    } catch (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }
  }

  async createTask(taskData) {
    try {
      // Ensure workspaceId is present (required by Motion API)
      if (!taskData.workspaceId) {
        try {
          const defaultWorkspace = await this.getDefaultWorkspace();
          taskData = { ...taskData, workspaceId: defaultWorkspace.id };
        } catch (workspaceError) {
          throw new Error('workspaceId is required to create a task and no default workspace could be found');
        }
      }

      // Validate required fields according to Motion API
      if (!taskData.name) {
        throw new Error('Task name is required');
      }

      const response = await this.makeRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });

      return response;
    } catch (error) {
      // Provide more specific error messages
      if (error.message.includes('400')) {
        if (error.message.includes('workspaceId')) {
          throw new Error('Invalid or missing workspaceId. Please provide a valid workspace ID.');
        } else if (error.message.includes('projectId')) {
          throw new Error('Invalid projectId. Please check that the project exists in the specified workspace.');
        }
      }

      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  async getTask(taskId) {
    try {
      const response = await this.makeRequest(`/tasks/${taskId}`);
      return response;
    } catch (error) {
      throw new Error(`Failed to fetch task: ${error.message}`);
    }
  }

  async updateTask(taskId, taskData) {
    try {
      const response = await this.makeRequest(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(taskData)
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  async deleteTask(taskId) {
    try {
      await this.makeRequest(`/tasks/${taskId}`, {
        method: 'DELETE'
      });
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  }

  async getWorkspaces() {
    try {
      const response = await this.makeRequest('/workspaces');

      // Motion API returns workspaces wrapped in a "workspaces" property
      let workspaces = response;

      if (workspaces && workspaces.workspaces && Array.isArray(workspaces.workspaces)) {
        // Expected structure: { workspaces: [...] }
        workspaces = workspaces.workspaces;
      } else if (!Array.isArray(workspaces)) {
        // Unexpected structure
        workspaces = [];
      }

      return workspaces;
    } catch (error) {
      throw new Error(`Failed to fetch workspaces: ${error.message}`);
    }
  }

  async getUsers() {
    try {
      const response = await this.makeRequest('/users');

      // Handle different response structures from Motion API
      let users = response;

      // If response is not an array, check if it's wrapped in a property
      if (!Array.isArray(users)) {
        if (users && users.users && Array.isArray(users.users)) {
          users = users.users;
        } else if (users && typeof users === 'object') {
          // If it's a single user object, wrap it in an array
          users = [users];
        } else {
          // If we can't determine the structure, return empty array
          users = [];
        }
      }

      return users;
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  async getDefaultWorkspace() {
    try {
      const workspaces = await this.getWorkspaces();

      if (!workspaces || workspaces.length === 0) {
        throw new Error('No workspaces available');
      }

      // Prefer the first workspace, but could add logic here to prefer certain types
      let defaultWorkspace = workspaces[0];

      // Look for a personal or individual workspace first
      const personalWorkspace = workspaces.find(w =>
        w.type === 'INDIVIDUAL' &&
        (w.name.toLowerCase().includes('personal') || w.name.toLowerCase().includes('my'))
      );

      if (personalWorkspace) {
        defaultWorkspace = personalWorkspace;
      }

      return defaultWorkspace;
    } catch (error) {
      throw error;
    }
  }

  async getWorkspaceByName(workspaceName) {
    try {
      const workspaces = await this.getWorkspaces();
      const workspace = workspaces.find(w => w.name.toLowerCase() === workspaceName.toLowerCase());

      if (!workspace) {
        throw new Error(`Workspace with name "${workspaceName}" not found`);
      }

      return workspace;
    } catch (error) {
      throw error;
    }
  }

  async getProjectByName(projectName, workspaceId = null) {
    try {
      if (!workspaceId) {
        const defaultWorkspace = await this.getDefaultWorkspace();
        workspaceId = defaultWorkspace.id;
      }

      const projects = await this.getProjects(workspaceId);
      const project = projects.find(p =>
        p.name.toLowerCase() === projectName.toLowerCase() ||
        p.name.toLowerCase().includes(projectName.toLowerCase())
      );

      if (!project) {
        throw new Error(`Project "${projectName}" not found in workspace`);
      }

      return project;
    } catch (error) {
      throw error;
    }
  }

  // Enhanced Intelligence Methods

  async getMotionContext(options = {}) {
    try {
      const {
        includeRecentActivity = true,
        includeWorkloadSummary = true,
        includeSuggestions = true
      } = options;

      const context = {
        timestamp: new Date().toISOString(),
        user: null,
        defaultWorkspace: null,
        workspaces: [],
        recentActivity: [],
        workloadSummary: {},
        suggestions: []
      };

      // Get user info and workspaces
      try {
        const [users, workspaces] = await Promise.all([
          this.getUsers(),
          this.getWorkspaces()
        ]);

        context.user = users[0] || null; // Assume first user is current user
        context.workspaces = workspaces;
        context.defaultWorkspace = await this.getDefaultWorkspace();
      } catch (error) {
        // Continue without user/workspace info if fetch fails
      }

      // Get recent activity if requested
      if (includeRecentActivity && context.defaultWorkspace) {
        try {
          const recentTasks = await this.getTasks({
            workspaceId: context.defaultWorkspace.id,
            limit: 10
          });

          context.recentActivity = recentTasks
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
            .slice(0, 5)
            .map(task => ({
              type: 'task',
              id: task.id,
              name: task.name,
              status: task.status,
              priority: task.priority,
              updatedAt: task.updatedAt || task.createdAt
            }));
        } catch (error) {
          // Continue without recent activity if fetch fails
        }
      }

      // Generate workload summary if requested
      if (includeWorkloadSummary && context.defaultWorkspace) {
        try {
          context.workloadSummary = await this.generateWorkloadSummary(context.defaultWorkspace.id);
        } catch (error) {
          // Continue without workload summary if generation fails
        }
      }

      // Generate suggestions if requested
      if (includeSuggestions && context.defaultWorkspace) {
        try {
          context.suggestions = await this.generateContextSuggestions(context.defaultWorkspace.id);
        } catch (error) {
          // Continue without suggestions if generation fails
        }
      }

      return context;
    } catch (error) {
      throw error;
    }
  }

  async searchContent(options) {
    try {
      const { query, searchScope = "both", workspaceId, limit = 20 } = options;

      let results = [];

      // Search tasks if scope includes tasks
      if (searchScope === "tasks" || searchScope === "both") {
        try {
          const tasks = await this.getTasks({ workspaceId });
          const taskResults = tasks
            .filter(task =>
              task.name.toLowerCase().includes(query.toLowerCase()) ||
              (task.description && task.description.toLowerCase().includes(query.toLowerCase()))
            )
            .map(task => ({
              ...task,
              type: 'task',
              relevance: this.calculateRelevance(task, query)
            }));

          results.push(...taskResults);
        } catch (error) {
          // Continue without task results if search fails
        }
      }

      // Search projects if scope includes projects
      if (searchScope === "projects" || searchScope === "both") {
        try {
          const projects = await this.getProjects(workspaceId);
          const projectResults = projects
            .filter(project =>
              project.name.toLowerCase().includes(query.toLowerCase()) ||
              (project.description && project.description.toLowerCase().includes(query.toLowerCase()))
            )
            .map(project => ({
              ...project,
              type: 'project',
              relevance: this.calculateRelevance(project, query)
            }));

          results.push(...projectResults);
        } catch (error) {
          // Continue without project results if search fails
        }
      }

      // Sort by relevance and limit results
      results = results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      return results;
    } catch (error) {
      throw error;
    }
  }

  calculateRelevance(item, query) {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact name match gets highest score
    if (item.name.toLowerCase() === queryLower) {
      score += 100;
    }
    // Name contains query
    else if (item.name.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Description contains query
    if (item.description && item.description.toLowerCase().includes(queryLower)) {
      score += 25;
    }

    // Boost score for high priority items
    if (item.priority === 'ASAP') score += 20;
    else if (item.priority === 'HIGH') score += 10;

    return score;
  }

  async analyzeWorkload(options) {
    try {
      const { workspaceId, timeframe = "this_week", includeProjects = true } = options;

      const wsId = workspaceId || (await this.getDefaultWorkspace()).id;
      const tasks = await this.getTasks({ workspaceId: wsId });

      const now = new Date();
      const analysis = {
        totalTasks: tasks.length,
        overdueTasks: 0,
        upcomingDeadlines: 0,
        taskDistribution: {
          byStatus: {},
          byPriority: {},
          byProject: {}
        },
        projectInsights: {}
      };

      // Analyze tasks
      tasks.forEach(task => {
        // Count overdue tasks
        if (task.dueDate && new Date(task.dueDate) < now) {
          analysis.overdueTasks++;
        }

        // Count upcoming deadlines (next 7 days)
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
          if (daysUntilDue >= 0 && daysUntilDue <= 7) {
            analysis.upcomingDeadlines++;
          }
        }

        // Task distribution by status
        analysis.taskDistribution.byStatus[task.status] =
          (analysis.taskDistribution.byStatus[task.status] || 0) + 1;

        // Task distribution by priority
        analysis.taskDistribution.byPriority[task.priority || 'NONE'] =
          (analysis.taskDistribution.byPriority[task.priority || 'NONE'] || 0) + 1;

        // Task distribution by project
        const projectKey = task.projectId || 'No Project';
        analysis.taskDistribution.byProject[projectKey] =
          (analysis.taskDistribution.byProject[projectKey] || 0) + 1;
      });

      // Project insights if requested
      if (includeProjects) {
        try {
          const projects = await this.getProjects(wsId);
          analysis.projectInsights = {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'active').length,
            completedProjects: projects.filter(p => p.status === 'completed').length
          };
        } catch (error) {
          // Continue without project insights if fetch fails
        }
      }

      return analysis;
    } catch (error) {
      throw error;
    }
  }

  async generateWorkloadSummary(workspaceId) {
    const tasks = await this.getTasks({ workspaceId });
    const now = new Date();

    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed' || t.status === 'done').length,
      inProgress: tasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length,
      highPriority: tasks.filter(t => t.priority === 'ASAP' || t.priority === 'HIGH').length
    };
  }

  async generateContextSuggestions(workspaceId) {
    const tasks = await this.getTasks({ workspaceId });
    const suggestions = [];

    // Find overdue tasks
    const overdueTasks = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < new Date()
    );

    if (overdueTasks.length > 0) {
      suggestions.push(`You have ${overdueTasks.length} overdue task(s) that need attention`);
    }

    // Find high priority tasks
    const highPriorityTasks = tasks.filter(t =>
      t.priority === 'ASAP' || t.priority === 'HIGH'
    );

    if (highPriorityTasks.length > 0) {
      suggestions.push(`Consider focusing on ${highPriorityTasks.length} high-priority task(s)`);
    }

    // Find tasks due soon
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const tasksDueSoon = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) <= soon && new Date(t.dueDate) >= new Date()
    );

    if (tasksDueSoon.length > 0) {
      suggestions.push(`${tasksDueSoon.length} task(s) are due within 24 hours`);
    }

    return suggestions;
  }

  async bulkUpdateTasks(taskIds, updates) {
    try {
      const updatePromises = taskIds.map(taskId =>
        this.updateTask(taskId, updates)
      );

      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        const failures = results
          .filter(r => r.status === 'rejected')
          .map(r => r.reason.message);

        throw new Error(`${failed} task updates failed: ${failures.join(', ')}`);
      }

      return { successful, failed };
    } catch (error) {
      throw error;
    }
  }

  async smartScheduleTasks(taskIds, workspaceId, preferences = {}) {
    try {
      // Get tasks to schedule
      let tasksToSchedule = [];
      if (taskIds && taskIds.length > 0) {
        // Get specific tasks
        const taskPromises = taskIds.map(id => this.getTask(id));
        const taskResults = await Promise.allSettled(taskPromises);
        tasksToSchedule = taskResults
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value);
      } else {
        // Get all unscheduled tasks in workspace
        const allTasks = await this.getTasks({ workspaceId });
        tasksToSchedule = allTasks.filter(task =>
          !task.scheduledStart || task.status === 'todo'
        );
      }

      // Sort tasks by priority and deadline
      const sortedTasks = tasksToSchedule.sort((a, b) => {
        // Priority order: ASAP > HIGH > MEDIUM > LOW
        const priorityOrder = { 'ASAP': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }

        // If same priority, sort by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate) - new Date(b.dueDate);
        }

        return 0;
      });

      // Generate schedule (simplified - in reality, this would use Motion's auto-scheduling)
      const schedule = sortedTasks.map((task, index) => {
        const startTime = new Date();
        startTime.setHours(9 + index, 0, 0, 0); // Start at 9 AM, one hour apart

        return {
          taskId: task.id,
          taskName: task.name,
          scheduledTime: startTime.toISOString(),
          priority: task.priority,
          estimatedDuration: task.duration || 60
        };
      });

      return schedule;
    } catch (error) {
      throw error;
    }
  }
}

export default MotionApiService;