fs = require('fs');
var archieml = require('archieml');
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const Identities = require('orbit-db-identity-provider')


async function run()
{
	const config_fn = 'config.aml';
	console.log(config_fn+' :');
	const config_text = fs.readFileSync('config.aml').toString();
	console.log(config_text);
	const config = archieml.load(config_text);
	const db_address = config.db_address || 'monitoringing';
	const bootstrap = config.bootstrap || [];


	console.log('bootstrap:')
	console.log(bootstrap)
	console.log()

	// https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/MODULE.md
	const ipfsOptions = {
		EXPERIMENTAL: {
			pubsub: true
		},
		// https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/CONFIG.md#addresses
		config: {
			Bootstrap: bootstrap

		},
		repo: './ipfs'
	}


	const ipfs = await IPFS.create(ipfsOptions)
	//await ipfs.config.profiles.apply('lowpower')
	setInterval(async () => await beep(ipfs), 1000);
	//ipfs.swarm.connect(bootstrap[0]);


	const identity = await Identities.createIdentity({id: 'test1'})

	console.log()
	console.log('publicKey:')
	console.log(identity.publicKey)
	console.log(identity)


	const orbitdb = await OrbitDB.createInstance(ipfs, {identity})
	console.log()
	console.log('orbitdb:')
	console.log(orbitdb)


	const db = await orbitdb.eventlog(db_address,
		{
			accessController: {
				type: 'orbitdb', //OrbitDBAccessController
				write: ['*'] //       write: [orbitdb.identity.id]
			}
		}
	)
	console.log('db_address:')
	console.log(db.address.toString());

	await db.add({creator: identity.publicKey})

	console.log()
	await print_items(db);
	// https://github.com/orbitdb/orbit-db/blob/main/API.md#replicated
	db.events.on('replicated', (address) => print_items())
	db.events.on('replicated', async (address) =>
	{
		await print_items(db)
	})



	db.events.on('replicated', (address) => console.log('replicated') )
	db.events.on('replicate', (address) => console.log('replicate') )
	db.events.on('replicate.progress', (address, hash, entry, progress, have) => console.log('replicate.progress') )
	db.events.on('load', (dbname) => console.log('load') )
	db.events.on('load.progress', (address, hash, entry, progress, total) => console.log('load.progress') )
	db.events.on('ready', (dbname, heads) => console.log('ready') )
	db.events.on('write', (address, entry, heads) => console.log('write') )
	db.events.on('peer', (peer) => console.log('peer') )
	db.events.on('closed', (dbname) => console.log('closed') )
	db.events.on('peer.exchanged', (peer, address, heads) => console.log('peer.exchanged') )


}

async function beep(ipfs)
{
	console.log( 'beep');
	console.log( await ipfs.swarm.peers());
}

async function print_items(db)
{
	console.log()
	console.log('items:')
	const all = db.iterator({limit: -1})
		.collect()
		.map((e) => console.log(e.payload.value));
}


(async () =>
{
	await run()
})();
