# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**synchronizer-cli** is a Node.js CLI application for managing Multisynq Synchronizer Docker containers with real-time WebSocket monitoring and web dashboard capabilities. The project uses Commander.js for CLI structure, Express for the web dashboard, and WebSocket for real-time communication.

## Essential Commands

### Development Workflow

```bash
# Run the CLI (no build required - pure JavaScript)
node index.js [command]

# Test the help output (basic test)
npm test

# Security scan before publishing
./security-scan.sh

# Pre-publish validation
node pre-publish-check.js

# Test WebSocket connections
node test-websocket-direct.js
node websocket-test.js
```

### Common CLI Commands

```bash
# Interactive setup
node index.js init

# Start synchronizer container
node index.js start

# Launch web dashboard
node index.js web
node index.js web --port 8080 --metrics-port 8081

# Check service status
node index.js status

# View points
node index.js points

# Validate synq key
node index.js validate-key [key]
```

### Publishing to NPM

```bash
# Run security and pre-publish checks first
./security-scan.sh
node pre-publish-check.js

# Publish to npm
npm publish
```

## Architecture Overview

### Main Application Structure

The entire application is contained in `index.js` (239KB), which implements:

1. **CLI Framework** - Commander.js-based command structure with subcommands
2. **Configuration Management** - Stored in `~/.synchronizer-cli/config.json`
3. **Docker Integration** - Container management via child_process.spawn
4. **Web Dashboard** - Express server with dual-port architecture
5. **WebSocket Client** - Real-time communication on port 3333
6. **API Integration** - Points API, Enterprise API, and validation endpoints

### Key Technical Details

1. **Port Configuration**:
   - Dashboard: Default 3000 (configurable with --port)
   - Metrics API: Default 3001 (configurable with --metrics-port)
   - WebSocket: Fixed at 3333 (server endpoint)

2. **Configuration Storage**:
   - Main config: `~/.synchronizer-cli/config.json`
   - Points cache: `~/.synchronizer-cli/points.json`
   - Other caches: Various JSON files for API responses

3. **Docker Container**:
   - Image: `cdrakep/synqchronizer:latest`
   - Multi-arch support: AMD64 and ARM64
   - Port mapping: 3333:3333 for WebSocket

4. **API Endpoints**:
   - Points API: `https://api.multisynq.io/points/[wallet]`
   - Enterprise API: `https://ent.multisynq.io/v1/`
   - Validation API: `https://api.multisynq.io/validate/[key]`

### WebSocket Implementation

The WebSocket client connects to `ws://localhost:3333` and handles:
- Container stats (CPU, memory, disk usage)
- Real-time metrics updates
- Connection retry logic with exponential backoff
- Message deduplication

### Web Dashboard Architecture

The dashboard uses a dual-server approach:
1. **Main Server** (port 3000): Serves HTML interface and dashboard APIs
2. **Metrics Server** (port 3001): Provides JSON API endpoints

Key dashboard endpoints:
- `GET /` - Main dashboard HTML
- `GET /api/status` - System status
- `GET /api/performance` - Performance metrics and QoS
- `GET /metrics` - Raw metrics JSON

## Development Notes

### Code Style

The project follows standard Node.js conventions:
- Callbacks and Promises (no async/await due to Node 10 compatibility)
- Commander.js action handlers for commands
- Express middleware for web routes
- Child process spawning for Docker commands

### Error Handling

The application implements comprehensive error handling:
- Docker installation detection and auto-install prompts
- Permission error handling with fix suggestions
- Platform compatibility checks
- WebSocket reconnection logic

### Security Considerations

- Sensitive data (synq keys) are masked in displays
- Configuration stored in user home directory
- Security scan script checks for exposed secrets
- Password protection for web dashboard

### Testing Approach

Current testing is minimal:
- `npm test` runs help command
- WebSocket test utilities in `test-websocket-direct.js` and `websocket-test.js`
- Manual testing of Docker commands and web dashboard

### Important File Locations

- Main application: `index.js`
- Configuration: `~/.synchronizer-cli/config.json`
- Points cache: `~/.synchronizer-cli/points.json`
- Systemd services: Generated in `~/.synchronizer-cli/`
- Deployment scripts: `startup-synchronizer.sh`, `startup-synchronizer-service.sh`

## Deployment and Distribution

### NPM Package

The package includes only essential files:
- `index.js` - Main application
- `README.md` - Documentation
- `ENTERPRISE.md` - Enterprise features
- `startup-synchronizer.sh` - Cloud deployment script

### Cloud Deployment

The `startup-synchronizer.sh` script provides automated deployment for:
- AWS EC2
- DigitalOcean
- Google Cloud
- Azure
- Any Ubuntu/Debian instance

### Version Management

The project tracks versions in multiple places:
- `package.json` - NPM package version
- Launcher ID - Format: `cli-[version]/docker-[croquet-version]`
- Docker image - Uses `latest` tag