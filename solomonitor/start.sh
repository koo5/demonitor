#!/usr/bin/env bash
#set -xv
/wait-for-it/wait-for-it.sh alertmanager:9093 -t 0
/wait-for-it/wait-for-it.sh checker:3000 -t 0
/wait-for-it/wait-for-it.sh karma:8080 -t 0
node src/index.js

