#!/usr/bin/env bash

docker service logs -f demonitor_alertmanager_karma_am &
docker service logs -f demonitor_alertmanager_karma_karma &
docker service logs -f demonitor_alertmanager_karma_demonitor 

