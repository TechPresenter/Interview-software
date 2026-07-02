// PM2 process definitions for HireSense (run from the project root):
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup   # keep running + start on server reboot
module.exports = {
  apps: [
    {
      name: 'hiresense-api',
      cwd: './server',
      script: 'npm',
      args: 'start', // = node src/server.js
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
    },
    {
      name: 'hiresense-web',
      cwd: './client',
      script: 'npm',
      args: 'start', // = next start (port 3000)
      env: { NODE_ENV: 'production', PORT: '3000' },
      max_restarts: 10,
    },
  ],
};
