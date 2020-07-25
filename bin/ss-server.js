#!/usr/bin/env node

const express = require('express');
const https = require('https');
const http = require('http');
const { resolve } = require('path');
const fs = require('fs');
const textBox = require('lil-textbox');
/* 
  inspiration and possibly better alternative:
  https://github.com/vercel/serve

*/
const tryParse = str => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
};

const path = p => resolve(process.env.PWD, p);

const defaultConfig = {
  port: 8080,
  dir: path('build'),
  host: 'localhost',
  quiet: false,
  key: path('ssl-cert.key'),
  cert: path('ssl-cert.crt'),
  config: '/path/to/config',
  ssl: true,
  cors: false,
};
const usage = `${Object.entries(defaultConfig)
  .map(
    ([k, v]) => `--${k}=<${typeof v}> \n    default: ${v} 
`,
  )
  .join('\n')}`;

const [_, __, ...args] = process.argv.map(a => a.trim());

if (args[0] === '--help') {
  textBox(['Usage:', '', ...usage.split('\n')]);
  process.exit(0);
}

let config;
let arg = 0;

try {
  config = args
    .map(d => ++arg && d.match(/--(\w+?)=(.+)/).slice(1, 3))
    .reduce((p, [k, v]) => ({ ...p, [k]: tryParse(v) }), {});
} catch (e) {
  throw new Error(`Unknown option: ${args[arg - 1]}

Options are; 

${usage}`);
}

if (config.config) {
  try {
    config = {
      ...Object.entries(JSON.parse(fs.readFileSync(config.config))).reduce(
        (p, [k, v]) => ({
          ...p,
          [k]:
            typeof v === 'string' && /\$[A-z_0-9]+/.test(v) //interpolates environment vars in config file -- TODO: alternatively execSync('echo hello $PWD').toString().trim()?
              ? v
                  .match(/\$[A-z_0-9]+/g)
                  .map(env => [env, process.env[env.substr(1)] || ''])
                  .reduce((p, [envK, envV]) => p.replace(envK, envV), v)
              : v,
        }),
        {},
      ),
      ...config,
    };
  } catch (e) {
    console.error('Error reading config file!');
    throw e;
  }
}

Object.keys(config).forEach(k => {
  if (k in defaultConfig) return;
  throw new Error(`Unknown option: --${k}

Options are; 

${usage}`);
});

config = { ...defaultConfig, ...config };

const app = express();

if (config.cors === true) {
  app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', ['*']);
    res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.append('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
}

app.use(express.static(config.dir));

if (!config.quiet) console.log(`Serving static assets from dir: ${config.dir}`);

(config.ssl
  ? https.createServer(
      {
        key: fs.readFileSync(config.key),
        cert: fs.readFileSync(config.cert),
      },
      app,
    )
  : http.createServer(app)
).listen(config.port, config.host, function(err) {
  if (err) {
    throw err;
  }

  const proto = config.ssl ? 'https' : 'http';
  textBox(
    `static server

cors: ${config.cors === true ? 'enabled' : 'disabled'}
ssl: ${config.ssl === true ? 'enabled' : 'disabled'}

url:  ${proto}://${config.host}:${config.port}




made with ❤  by @rpolana
  `.split('\n'),
    { print: !config.quiet }
  );
});

