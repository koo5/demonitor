## concepts
### node
A node is an instance of demonitor, installed on a machine, and configured with the database ID that all your other nodes share, and, optionally, with IPFS configured with the ID of your private IPFS network. It is

### check
A check can be set to be executed on a particular node or on all nodes. It has an interval - how often it's run.

### non-head node
Similar to the concept of an agent in other monitoring systems. A dumb node that performs checks and reports success or failure.

### head node
Is a node ran along with karma and alertmanager. Reads results of checks and:
 * for each check in its configuration file, performs heartbeat-checking logic, potentially fires alerts 
 * for each ckeck, fires an alert if the result indicates failure

### alert severity / SLA
It's generally useful to inform users of any anomaly, but some number of anomialies is expected. It's yet to be figured out how to configure this, probably by js code.


### db service
A (decentralized) database or messaging system is abstracted away by a microservice. It should be configured to notify the main service of new events.





```
OrbitDB:
	serious problem: the db just keeps growing, there's no way to control what you keep. There are 3 levels:
		ipfs cache - not really a worry, you can control how big it is
		OrbitDB on-disk storage - the whole database is there
		OrbitDB in-memory data structures: the whole database is there
```
