fs = require('fs');
var archieml = require('archieml');
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const Identities = require('orbit-db-identity-provider')
var moment = require('moment');


async function run()
{
	const config_fn = 'config.aml';
	console.log(config_fn+' :');
	const config_text = fs.readFileSync('config.aml').toString();
	console.log(config_text);
	const config = archieml.load(config_text);
	const db_address = config.db_address || 'monitoringing2';



	const default_bootstrap_override = config.default_bootstrap_override;
	console.log('default_bootstrap_override:')
	console.log(default_bootstrap_override)
	console.log()
	/*
	finishme:
	const additional_bootstrap_nodes = config.additional_bootstrap_nodes || [];
	console.log('additional_bootstrap_nodes:')
	console.log(additional_bootstrap_nodes)
	console.log()
	 */


	// https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/MODULE.md
	const ipfsOptions = {
		EXPERIMENTAL: {
			pubsub: true
		},
		// https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/CONFIG.md#addresses
		config: {
			Bootstrap: default_bootstrap_override
		},
		repo: './ipfs'
	}



	const ipfs = await IPFS.create(ipfsOptions)
	//await ipfs.config.profiles.apply('lowpower')

	//ipfs.swarm.connect(bootstrap[0]);


	const identity = await Identities.createIdentity({id: 'test1'})

	console.log()
	console.log('publicKey:')
	console.log(identity.publicKey)
	//console.log(identity)


	const orbitdb = await OrbitDB.createInstance(ipfs, {identity})
	/*console.log()
	console.log('orbitdb:')
	console.log(orbitdb)*/


	const db = await orbitdb.log(db_address,
		{
			accessController: {
				type: 'orbitdb', //OrbitDBAccessController
				write: ['*'] //       write: [orbitdb.identity.id]
			}
		}
	)
	console.log('db_address:')
	console.log(db.address.toString());

	console.log()
	await print_items(db);

	db.load();
	console.log()
	await print_items(db);


	// https://github.com/orbitdb/orbit-db/blob/main/API.md#replicated
	db.events.on('replicated', async (address) => {console.log('replicated'); await print_items(db);} )
	db.events.on('replicate', (address) => console.log('going to replicate a part of the database with a peer...') )
	db.events.on('replicate.progress', (address, hash, entry, progress, have) => console.log('replicate.progress') )
	db.events.on('load', (dbname) => console.log('load') )
	db.events.on('load.progress', (address, hash, entry, progress, total) => console.log('load.progress') )
	db.events.on('write', (address, entry, heads) => console.log('write') )
	db.events.on('peer', (peer) => console.log('peer') )
	db.events.on('closed', (dbname) => console.log('closed') )
	db.events.on('peer.exchanged', (peer, address, heads) => console.log('peer.exchanged') )
	db.events.on('ready', () => {
	  console.log('database is now ready to be queried');
	})

	setInterval(async () => await beep(ipfs,db), 10000);
}

async function beep(ipfs, db)
{
	console.log( '<beep!>');
	await db.add({ts:moment().format()})
	console.log( 'peers:');
	console.log( await ipfs.swarm.peers());
	print_items(db);
}

async function print_items(db)
{
	console.log()
	console.log('items:')
	const items = db.iterator({limit: -1}).collect();

	items.map((e) => {
		console.log({
			source:e.identity.id,
			value:e.payload.value
		});
	});
	console.log('(' + items.length+')')
}


(async () =>
{
	await run()
})();
