#!/usr/bin/env bash
npm i
npm run build
npm i -g --force
chmod +x dist/cli.js