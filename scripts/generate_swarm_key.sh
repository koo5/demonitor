#!/usr/bin/env fish

set DIR (dirname (readlink -m (status --current-filename)))
cd "$DIR"


cd ..
mkdir secrets/
go get github.com/Kubuxu/go-ipfs-swarm-key-gen/ipfs-swarm-key-gen
~/go/bin/ipfs-swarm-key-gen > secrets/swarm.key

