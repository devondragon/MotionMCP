const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class MotionApiService {
  constructor() {
    this.apiKey = process.env.MOTION_API_KEY;
    this.baseUrl = 'https://api.usemotion.com/v1';
    
    if (!this.apiKey) {
      throw new Error('MOTION_API_KEY environment variable is required');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error('Motion API error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  async getProjects() {
    try {
      const response = await this.client.get('/projects');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch projects: ${error.response?.data?.message || error.message}`);
    }
  }

  async createProject(projectData) {
    try {
      const response = await this.client.post('/projects', projectData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create project: ${error.response?.data?.message || error.message}`);
    }
  }

  async getProject(projectId) {
    try {
      const response = await this.client.get(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch project: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateProject(projectId, projectData) {
    try {
      const response = await this.client.patch(`/projects/${projectId}`, projectData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update project: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteProject(projectId) {
    try {
      await this.client.delete(`/projects/${projectId}`);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete project: ${error.response?.data?.message || error.message}`);
    }
  }

  async getTasks(options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.projectId) params.append('projectId', options.projectId);
      if (options.status) params.append('status', options.status);
      if (options.assigneeId) params.append('assigneeId', options.assigneeId);
      
      const response = await this.client.get(`/tasks?${params}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch tasks: ${error.response?.data?.message || error.message}`);
    }
  }

  async createTask(taskData) {
    try {
      const response = await this.client.post('/tasks', taskData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create task: ${error.response?.data?.message || error.message}`);
    }
  }

  async getTask(taskId) {
    try {
      const response = await this.client.get(`/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch task: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateTask(taskId, taskData) {
    try {
      const response = await this.client.patch(`/tasks/${taskId}`, taskData);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update task: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteTask(taskId) {
    try {
      await this.client.delete(`/tasks/${taskId}`);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete task: ${error.response?.data?.message || error.message}`);
    }
  }

  async getWorkspaces() {
    try {
      const response = await this.client.get('/workspaces');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch workspaces: ${error.response?.data?.message || error.message}`);
    }
  }

  async getUsers() {
    try {
      const response = await this.client.get('/users');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = MotionApiService;