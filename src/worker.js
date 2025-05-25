class MotionApiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.usemotion.com/v1';
  }

  async makeRequest(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      throw new Error(`Motion API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getProjects() {
    return this.makeRequest('/projects');
  }

  async createProject(projectData) {
    return this.makeRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  }

  async getProject(projectId) {
    return this.makeRequest(`/projects/${projectId}`);
  }

  async updateProject(projectId, projectData) {
    return this.makeRequest(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(projectData)
    });
  }

  async deleteProject(projectId) {
    await this.makeRequest(`/projects/${projectId}`, {
      method: 'DELETE'
    });
    return { success: true };
  }

  async getTasks(options = {}) {
    const params = new URLSearchParams();
    if (options.projectId) params.append('projectId', options.projectId);
    if (options.status) params.append('status', options.status);
    if (options.assigneeId) params.append('assigneeId', options.assigneeId);
    
    const query = params.toString();
    return this.makeRequest(`/tasks${query ? '?' + query : ''}`);
  }

  async createTask(taskData) {
    return this.makeRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  }

  async getTask(taskId) {
    return this.makeRequest(`/tasks/${taskId}`);
  }

  async updateTask(taskId, taskData) {
    return this.makeRequest(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(taskData)
    });
  }

  async deleteTask(taskId) {
    await this.makeRequest(`/tasks/${taskId}`, {
      method: 'DELETE'
    });
    return { success: true };
  }

  async getWorkspaces() {
    return this.makeRequest('/workspaces');
  }

  async getUsers() {
    return this.makeRequest('/users');
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (!env.MOTION_API_KEY) {
    return errorResponse('Motion API key not configured', 503);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const motionService = new MotionApiService(env.MOTION_API_KEY);

  try {
    if (path === '/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (!path.startsWith('/api/motion/')) {
      return errorResponse('Not found', 404);
    }

    const apiPath = path.replace('/api/motion', '');
    const method = request.method;
    const searchParams = url.searchParams;

    if (apiPath === '/projects') {
      if (method === 'GET') {
        const projects = await motionService.getProjects();
        return jsonResponse(projects);
      }
      if (method === 'POST') {
        const body = await request.json();
        if (!body.name) {
          return errorResponse('Project name is required', 400);
        }
        const project = await motionService.createProject(body);
        return jsonResponse(project, 201);
      }
    }

    if (apiPath.startsWith('/projects/')) {
      const projectId = apiPath.split('/')[2];
      if (method === 'GET') {
        const project = await motionService.getProject(projectId);
        return jsonResponse(project);
      }
      if (method === 'PATCH') {
        const body = await request.json();
        if (Object.keys(body).length === 0) {
          return errorResponse('No valid fields to update', 400);
        }
        const project = await motionService.updateProject(projectId, body);
        return jsonResponse(project);
      }
      if (method === 'DELETE') {
        await motionService.deleteProject(projectId);
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
    }

    if (apiPath === '/tasks') {
      if (method === 'GET') {
        const options = {};
        if (searchParams.get('projectId')) options.projectId = searchParams.get('projectId');
        if (searchParams.get('status')) options.status = searchParams.get('status');
        if (searchParams.get('assigneeId')) options.assigneeId = searchParams.get('assigneeId');
        
        const tasks = await motionService.getTasks(options);
        return jsonResponse(tasks);
      }
      if (method === 'POST') {
        const body = await request.json();
        if (!body.name) {
          return errorResponse('Task name is required', 400);
        }
        const task = await motionService.createTask(body);
        return jsonResponse(task, 201);
      }
    }

    if (apiPath.startsWith('/tasks/')) {
      const taskId = apiPath.split('/')[2];
      if (method === 'GET') {
        const task = await motionService.getTask(taskId);
        return jsonResponse(task);
      }
      if (method === 'PATCH') {
        const body = await request.json();
        if (Object.keys(body).length === 0) {
          return errorResponse('No valid fields to update', 400);
        }
        const task = await motionService.updateTask(taskId, body);
        return jsonResponse(task);
      }
      if (method === 'DELETE') {
        await motionService.deleteTask(taskId);
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
    }

    if (apiPath === '/workspaces' && method === 'GET') {
      const workspaces = await motionService.getWorkspaces();
      return jsonResponse(workspaces);
    }

    if (apiPath === '/users' && method === 'GET') {
      const users = await motionService.getUsers();
      return jsonResponse(users);
    }

    return errorResponse('Not found', 404);

  } catch (error) {
    console.error('Worker error:', error);
    if (error.message.includes('Motion API error')) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      return errorResponse(error.message, statusCode);
    }
    return errorResponse('Internal server error', 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};