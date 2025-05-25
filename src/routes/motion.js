const express = require('express');
const MotionApiService = require('../services/motionApi');

const router = express.Router();
let motionService;

try {
  motionService = new MotionApiService();
} catch (error) {
  console.error('Failed to initialize Motion API service:', error.message);
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const validateMotionService = (req, res, next) => {
  if (!motionService) {
    return res.status(503).json({ 
      error: 'Motion API service unavailable. Check MOTION_API_KEY configuration.' 
    });
  }
  next();
};

router.get('/projects', validateMotionService, asyncHandler(async (req, res) => {
  const projects = await motionService.getProjects();
  res.json(projects);
}));

router.post('/projects', validateMotionService, asyncHandler(async (req, res) => {
  const { name, description, color, status } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const projectData = { name };
  if (description) projectData.description = description;
  if (color) projectData.color = color;
  if (status) projectData.status = status;

  const project = await motionService.createProject(projectData);
  res.status(201).json(project);
}));

router.get('/projects/:id', validateMotionService, asyncHandler(async (req, res) => {
  const project = await motionService.getProject(req.params.id);
  res.json(project);
}));

router.patch('/projects/:id', validateMotionService, asyncHandler(async (req, res) => {
  const { name, description, color, status } = req.body;
  
  const updateData = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (color) updateData.color = color;
  if (status) updateData.status = status;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const project = await motionService.updateProject(req.params.id, updateData);
  res.json(project);
}));

router.delete('/projects/:id', validateMotionService, asyncHandler(async (req, res) => {
  await motionService.deleteProject(req.params.id);
  res.status(204).send();
}));

router.get('/tasks', validateMotionService, asyncHandler(async (req, res) => {
  const options = {};
  if (req.query.projectId) options.projectId = req.query.projectId;
  if (req.query.status) options.status = req.query.status;
  if (req.query.assigneeId) options.assigneeId = req.query.assigneeId;

  const tasks = await motionService.getTasks(options);
  res.json(tasks);
}));

router.post('/tasks', validateMotionService, asyncHandler(async (req, res) => {
  const { name, description, status, priority, dueDate, projectId, assigneeId } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Task name is required' });
  }

  const taskData = { name };
  if (description) taskData.description = description;
  if (status) taskData.status = status;
  if (priority) taskData.priority = priority;
  if (dueDate) taskData.dueDate = dueDate;
  if (projectId) taskData.projectId = projectId;
  if (assigneeId) taskData.assigneeId = assigneeId;

  const task = await motionService.createTask(taskData);
  res.status(201).json(task);
}));

router.get('/tasks/:id', validateMotionService, asyncHandler(async (req, res) => {
  const task = await motionService.getTask(req.params.id);
  res.json(task);
}));

router.patch('/tasks/:id', validateMotionService, asyncHandler(async (req, res) => {
  const { name, description, status, priority, dueDate, projectId, assigneeId } = req.body;
  
  const updateData = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (status) updateData.status = status;
  if (priority) updateData.priority = priority;
  if (dueDate !== undefined) updateData.dueDate = dueDate;
  if (projectId) updateData.projectId = projectId;
  if (assigneeId) updateData.assigneeId = assigneeId;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const task = await motionService.updateTask(req.params.id, updateData);
  res.json(task);
}));

router.delete('/tasks/:id', validateMotionService, asyncHandler(async (req, res) => {
  await motionService.deleteTask(req.params.id);
  res.status(204).send();
}));

router.get('/workspaces', validateMotionService, asyncHandler(async (req, res) => {
  const workspaces = await motionService.getWorkspaces();
  res.json(workspaces);
}));

router.get('/users', validateMotionService, asyncHandler(async (req, res) => {
  const users = await motionService.getUsers();
  res.json(users);
}));

router.use((error, req, res, next) => {
  if (error.message.includes('Failed to')) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    return res.status(statusCode).json({ error: error.message });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;