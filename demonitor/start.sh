#!/usr/bin/env bash
set -xv
../wait-for-it/wait-for-it.sh alertmanager:9093 -t 300
node src/index.js

