#!/usr/bin/env bash
#set -xv
/wait-for-it/wait-for-it.sh alertmanager:9093 -t 30
/wait-for-it/wait-for-it.sh ipfs:5001 -t 30
/wait-for-it/wait-for-it.sh checker:3000 -t 30
/wait-for-it/wait-for-it.sh karma:8080 -t 30
/wait-for-it/wait-for-it.sh echo:5001 -t 30
node src/index.js

