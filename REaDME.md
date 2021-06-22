# what is this?
A proof-of-concept of a server monitoring application, where your nodes connect and relay information ad-hoc through IPFS. Docker swarm file is provided that spins up IPFS, the monitoring app itself, Alertmanager and Karma. The monitoring app periodically runs checks defined in checks.js, and saves the results into an OrbitDB eventlog, where your other nodes can find it and feed alerts into Alertmanager.


# tech choices

## other p2p db tech considered:
### GUN
Actually a triplestore, but with autogenerated identifiers instead of URIs. Ambitions to add micropayment-incentivized routing and other stuff: https://gun.eco/docs/AXE . The API seems a bit confusing compared to OrbitDB, and i didn't want their idea of a graph clash with mine (but shouln't be a problem in practice).


### SSB
This is actually a special-purpose protocol for a twitter-like app, so, it has a "message" type but also a "binary blob" type. 
"SSB has the concept of identity where a feed can be owned by only one identity. An identity in the case of SSB is simply an asymmetric key pair. "

### OrbitDB
Finally, i'm going with OrbitDB IPFS. 

libp2p is the modular communication layer: https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md#content-routing

It gives us a way to exchange blocks of data adressed by hashes. IPFS adds some "filesystem-like" logic on top of that, for some strange reason... Anyway, then, we have the problem of keeping track of the "tip". 
> Ceramic is a public, decentralized, censorship-resistant network for managing mutable information on the open internet without databases or servers. In Ceramic all content is stored in smart documents, which are append-only IPFS logs where each commit is signed by a decentralized identifier (DID) for verifiability and then subsequently anchored in a blockchain for consensus.

For the purposes of demonitor, blockchain isn't needed, though. We can simply trust all nodes to hold no malicious intent and always announce the tip of the linked list.

After program start, the database is "loaded". Loading multiple thousand entries takes minutes.  

### IPFS
there are two implementations of IPFS: js-ipfs, and go-ipfs. It's possible to run js-ipfs in-process. It is not quite mature, though. go-ipfs is set up to run as a standalone docker container.


### swarm key
this has the effect that our nodes never talk to any stranger nodes. 

#### log
An immutable "event log'. You append JSON objects.


# bootstrapping

ipfs-js (or ipfs itself, i guess) has a default list of bootstrap nodes. You can replace it by specifying a `[default_bootstrap_override]` list in `config.aml`.




# data format

Equivalent information could be relayed in different ways:

as json:
```
# an event
{
	@id: e1
	type: FailEvent
	source: node1
	ts: 11111
	output: ieoeoeoeoieoeo
}
```
as triples:
```
e1 type: FailEvent;
	source: node1;
	ts: 11111;
	output: ieoeoeoeoieoeo;
```
as quads in predicate-oriented way (RDF-star-ish syntax):
```
{node1 hasEvent FailEvent}
	ts: 11111;
	output: ieoeoeoeoieoeo;
```
This seems to save one quad and seems attractive in that it doesn't create arbitrary objects, rather, we have statements about preexisting objects. 



# OpenTelemetry

Should this be an OpenTelemetry collector exporter (loaded into a collector agent, on each host)? Resources:

https://lightstep.com/blog/opentelemetry-101-what-is-an-exporter/

https://opentelemetry.io/docs/collector/configuration/#exporters



note that this is(?) different from the concept of an instrumentation exporter:
	
https://github.com/orbitdb/opentelemetry-plugin-orbitdb/blob/main/src/orbitdb.ts




# monitoring client apps / mobile apps

The main (and possibly only) functionality of such an app is to alert you when it loses connectivity to your alerting server. In my case, one server will run on my notebook, another on a VPS. My point here is that other services can be used to route notifications to you (discord, jabber..)



# browser deployment
## notes
```
Personally I just setup a webrtc-star server using docker (behind a traefik reverse proxy) and that seems to work well for my p2p connections. Although I just tested with home NAT <=> mobile network yet.
```
https://github.com/libp2p/js-libp2p-webrtc-star




# heartbeat
i feel that heartbeat should be a property of individual checks, rather than of the agent itself, because an agent should be expected to be offline sometimes (for example on a suspended development computer) 


