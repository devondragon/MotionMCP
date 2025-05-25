### Build a NodeJS MCP Server for Motion API Integration (API Key Auth, Dockerized)

1. Initialize Node project, install dependencies (`express`, `axios`, `dotenv`, `winston`, `cors`)
2. Create folder structure for `src`, `routes`, `services`, `utils`
3. Load Motion API key and port from `.env`
4. Implement Express server (`src/index.js`) with CORS, JSON parsing, and health check
5. Create a Motion API service (`src/services/motionApi.js`):
   - Implement functions to list/create/update/delete projects and tasks using Motion API
   - Use API key in `Authorization` header (`Bearer <MOTION_API_KEY>`)
   - Handle errors and log failures
6. Create RESTful routes in `src/routes/motion.js` for projects and tasks, map to service functions
7. Add basic input validation and error handling for all endpoints
8. Wire up all routes in `src/index.js`
9. (Optional) Add advanced/sync/scheduling logic as new endpoints
10. Never log the API key; keep all secrets out of logs
11. Dockerize the server:
	- Write `Dockerfile` using Node Alpine image
	- Copy code, install dependencies, expose port, set CMD
	- Add `.dockerignore`
12. Write `README.md` with usage, config, Motion API key instructions, and endpoint docs
13. (Optional) Write basic integration tests with Jest/Mocha/Supertest
14. (Optional) Add health check and production deployment configs
15. Add support for deploying it as Cloudflare Worker 

**Motion API Docs:** https://docs.usemotion.com/

**NOTE:** Use Motion API key authentication, not OAuth2.

---