#!/usr/bin/env bash


stack rm demonitor_alertmanager_karma                                                                                      0 < 22:58:19


cd configurable_karma;
docker build -t  "koo5/configurable_karma"  -f "./Dockerfile" . ;  
cd ..

cd demonitor
docker build -t  "koo5/demonitor"  -f "./Dockerfile" . ; 
cd ..

docker stack deploy --prune --compose-file stack.yml demonitor_alertmanager_karma
