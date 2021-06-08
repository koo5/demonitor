#!/usr/bin/env bash

cd configurable_karma;
docker build -t  "koo5/configurable_karma"  -f "./Dockerfile" . ;  
cd ..

docker stack deploy --prune --compose-file stack.yml demonitor_alertmanager_karma
