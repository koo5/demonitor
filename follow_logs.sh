#!/usr/bin/env fish

set STACK_NAME $argv[1]

docker service logs -f $STACK_NAME"_alertmanager" &
docker service logs -f $STACK_NAME"_karma" &
docker service logs -f $STACK_NAME"_demonitor" &
docker service logs -f $STACK_NAME"_echo" &
docker service logs -f $STACK_NAME"_ipfs" &
true

