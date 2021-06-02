fs = require('fs');
var archieml = require('archieml');
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const Identities = require('orbit-db-identity-provider')



async function run() 
{
	const config_text = fs.readFileSync('config.aml').toString();
	console.log(config_text);
	const config = archieml.load(config_text);
	const db_address = config.db_address || 'monitoringing';
	const bootstrap = config.bootstrap || [];
	

	// https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/MODULE.md
const ipfsOptions = {
  EXPERIMENTAL: {
    pubsub: true
  },
  // https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/CONFIG.md#addresses
  config: {Bootstrap: bootstrap},
  repo: './ipfs'
	}

	
	
	const ipfs = await IPFS.create(ipfsOptions)
	//await ipfs.config.profiles.apply('lowpower')


	
	const identity = await Identities.createIdentity( { id: 'test1' })
	
	console.log()
	console.log('publicKey:')
	console.log(identity.publicKey)



	const orbitdb = await OrbitDB.createInstance(ipfs, {identity})
		
	
	const db = await orbitdb.eventlog(db_address,
			{accessController: {
      type: 'orbitdb', //OrbitDBAccessController
      write: ['*']
		}}
	)
	console.log('db_address:')
	console.log(db.address.toString());
	
	await db.add({ creator: identity.publicKey })

	console.log()
	await print_items(db);
	// https://github.com/orbitdb/orbit-db/blob/main/API.md#replicated
	db.events.on('replicated', (address) => print_items())
	db.events.on('replicated', async (address) => {await print_items(db)})
	db.events.on('peer', (peer) => console.log(peer))
}

async function print_items(db)
{
	console.log()
	console.log('items:')
	const all = db.iterator({ limit: -1 })
	.collect()
//	.map((e) => e.payload.value)
	.map((e) => console.log(e));
}


(async () => {await run()})();
