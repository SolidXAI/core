#!/usr/bin/env bash
npm i
npm run build 
rm ~/.nvm/versions/node/v22.13.1/bin/solidCore
npm i -g
chmod +x dist/cli.js