// server.js — MCPanel Orchestration Backend for Render.com
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'mcpanel-dev-key';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

app.use(cors());
app.use(express.json());

// ─── Auth Middleware ───
function authenticate(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
}

app.use('/api', authenticate);

// ─── In-Memory State (replace with Docker SDK in production) ───
const containers = new Map();

function createContainer(config) {
  const containerId = crypto.randomBytes(16).toString('hex');
  const container = {
    id: containerId,
    name: config.name,
    type: config.type || 'paper',
    version: config.version || '1.21.1',
    port: config.port || 25565,
    ramMb: config.ramMb || 2048,
    maxPlayers: config.maxPlayers || 20,
    status: 'created',
    createdAt: new Date().toISOString(),
  };
  containers.set(containerId, container);
  return container;
}

// ─── API Routes ───

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    containers: containers.size,
    timestamp: new Date().toISOString(),
  });
});

// Create server
app.post('/api/servers', (req, res) => {
  try {
    const { name, type, version, port, ramMb, maxPlayers } = req.body;
    if (!name) return res.status(400).json({ error: 'Server name is required' });

    const container = createContainer({
      name,
      type,
      version,
      port,
      ramMb,
      maxPlayers,
    });

    // Simulate startup delay
    setTimeout(() => {
      const c = containers.get(container.id);
      if (c) {
        c.status = 'running';
        c.startedAt = new Date().toISOString();
        console.log(
          `[Docker] Container ${c.name} (${c.id.slice(0, 12)}) is now running`
        );
      }
    }, 3000);

    console.log(`[Docker] Creating container "${name}" (${type} ${version})`);
    res.status(201).json({ success: true, container });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List servers
app.get('/api/servers', (_req, res) => {
  const list = Array.from(containers.values()).map((c) => ({
    ...c,
    cpuUsage:
      c.status === 'running'
        ? +(Math.random() * 30 + 10).toFixed(1)
        : 0,
    ramUsage:
      c.status === 'running'
        ? +(Math.random() * 40 + 30).toFixed(1)
        : 0,
    players:
      c.status === 'running'
        ? Math.floor(Math.random() * c.maxPlayers * 0.3)
        : 0,
  }));
  res.json({ success: true, servers: list });
});

// Get single server
app.get('/api/servers/:id', (req, res) => {
  const container = containers.get(req.params.id);
  if (!container)
    return res.status(404).json({ error: 'Server not found' });
  res.json({ success: true, container });
});

// Start server
app.post('/api/servers/:id/start', (req, res) => {
  const container = containers.get(req.params.id);
  if (!container)
    return res.status(404).json({ error: 'Server not found' });
  if (container.status === 'running')
    return res.json({ success: false, message: 'Already running' });

  container.status = 'starting';
  console.log(`[Docker] Starting container ${container.name}`);

  setTimeout(() => {
    container.status = 'running';
    container.startedAt = new Date().toISOString();
    console.log(`[Docker] Container ${container.name} started`);
  }, 3000);

  res.json({ success: true, message: 'Server starting' });
});

// Stop server
app.post('/api/servers/:id/stop', (req, res) => {
  const container = containers.get(req.params.id);
  if (!container)
    return res.status(404).json({ error: 'Server not found' });
  if (container.status === 'stopped')
    return res.json({ success: false, message: 'Already stopped' });

  container.status = 'stopping';
  console.log(`[Docker] Stopping container ${container.name}`);

  setTimeout(() => {
    container.status = 'stopped';
    container.stoppedAt = new Date().toISOString();
    console.log(`[Docker] Container ${container.name} stopped`);
  }, 2000);

  res.json({ success: true, message: 'Server stopping' });
});

// Restart server
app.post('/api/servers/:id/restart', (req, res) => {
  const container = containers.get(req.params.id);
  if (!container)
    return res.status(404).json({ error: 'Server not found' });

  container.status = 'stopping';
  console.log(`[Docker] Restarting container ${container.name}`);

  setTimeout(() => {
    container.status = 'starting';
    setTimeout(() => {
      container.status = 'running';
      container.startedAt = new Date().toISOString();
      console.log(`[Docker] Container ${container.name} restarted`);
    }, 3000);
  }, 2000);

  res.json({ success: true, message: 'Server restarting' });
});

// Delete server
app.delete('/api/servers/:id', (req, res) => {
  const container = containers.get(req.params.id);
  if (!container)
    return res.status(404).json({ error: 'Server not found' });

  containers.delete(req.params.id);
  console.log(`[Docker] Deleted container ${container.name}`);
  res.json({ success: true, message: 'Server deleted' });
});

// ─── Start ───
app.listen(PORT, () => {
  console.log(
    `\n🟢 MCPanel Orchestration Backend running on port ${PORT}`
  );
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(
    `   API Key: ${API_KEY === 'mcpanel-dev-key' ? '⚠️ Using default (set API_KEY env var)' : '✅ Custom key configured'}\n`
  );
});
