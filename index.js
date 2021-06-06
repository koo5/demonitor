/*

we'll have to make this able to run in browser too.




 */


require('dotenv').config();
fs = require('fs');
var archieml = require('archieml');
const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')
const Identities = require('orbit-db-identity-provider')
var moment = require('moment');
const axios = require('axios');
const checker = require('checker');
const alerter = require('alerter');


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
	/* or:
	        const ipfs = IpfsApi('localhost', '5001')
	        // If you want a programmatic way to spawn a IPFS Daemon using JavaScript, check out the ipfsd-ctl module.
	 */

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
	//await print_events(db);



	console.log('load...')
	db.load(-1);
	//await print_events(db);
start_http_server(db);

	console.log()

	// https://github.com/orbitdb/orbit-db/blob/main/API.md#replicated
	db.events.on('replicated', async (address) => {
		console.log('replicated'); /*await print_events(db);*/} )
	db.events.on('replicate', (address) =>
		console.log('going to replicate a part of the database with a peer...') )
	db.events.on('replicate.progress', (address, hash, entry, progress, have) => {
		console.log(`replicate.progress: ${address}, ${hash}, ${JSON.stringify(entry,null,'')}, ${progress}, ${have}`) })
	db.events.on('load', (dbname) =>
		console.log('going to load the database...') )
	db.events.on('load.progress', (address, hash, entry, progress, total) => {
		if (progress % 100 == 0)
			console.log(`load.progress: ${address}, ${hash}, ${progress} of ${total}`)
	})
	db.events.on('write', (address, entry, heads) => {
		console.log(`entry was added locally to the database: ${address}, ${JSON.stringify(entry,null,'')}, ${JSON.stringify(heads)}`) })
	db.events.on('peer', (peer) =>
		console.log(`peer: ${peer}`) )
	db.events.on('closed', (dbname) =>
		console.log('closed') )
	db.events.on('peer.exchanged', (peer, address, heads) => {
		console.log(`peer.exchanged: ${peer}, ${JSON.stringify(address,null,'')}, ${heads}`) })
	db.events.on('ready', () => {
		console.log('database is now ready to be queried');

		start_checking_events();

	})

	initialize_checks();
	setInterval(async () => await beep(ipfs,db), 30000);
}

async function beep(ipfs, db)
{
	console.log( '<beep!>');
	await db.add({ts:moment().format()})
	console.log( 'peers:');
	console.log( await ipfs.swarm.peers({direction:true,streams:true,verbose:true,latency:true}));
//	print_events(db);
}

function get_events(db)
{
	return db.iterator({limit: -1}).collect();
}

async function print_events(db)
{
	console.log()
	console.log('items:')
	const events = get_events(db);
	events.map((e) => {
		console.log({
			source:e.identity.id,
			value:e.payload.value
		});
	});
	console.log('(' + events.length+')')
}


(async () =>
{
	await run();
})();



function start_http_server(db)
{
	console.log('start_http_server..')
	const express = require('express')
	const app = express()
	const port = 3223

	app.get('/events', (req, res) =>
	{
		var result = '<html><body>';
		const events = get_events(db);
		events.forEach((e) => {
			result += '<pre>'
			result += JSON.stringify(e.payload.value, null, ' ');
			result += '</pre>'
		})
		result += '</body></html>';
		res.send(result)
	})

	app.get('/events_full', (req, res) =>
	{
		var result = '<html><body>';
		const events = get_events(db);
		events.forEach((e) => {
			result += '<pre>'
			result += JSON.stringify(e, null, ' ');
			result += '</pre>'
		})
		result += '</body></html>';
		res.send(result)
	})

	app.listen(port, () =>
	{
		console.log(`Example app listening at http://localhost:${port}`)
	})
	console.log(`/app.listen`)
}

const checks = [
	{node: 'dev', interval: 900, type: chat, target: process.env.VMI1},
	{node: 'dev', interval: 900, type: chat, target: process.env.AZURE},
	{node: 'azure', interval: 900, type: chat, target: process.env.VMI1},
	{node: 'vmi1', interval: 900, type: chat, target: process.env.AZURE},
];

function initialize_checks(db)
{
	checks.map(initialize_periodic_check);
}

function initialize_periodic_check(task)
{
	setInterval(task.interval, async () => await do_task(task));
}

async function do_task(task)
{
	{
		var ok = false;
		if (task.type == 'chat')
		{
			try
			{
				const r = await axios.post(task.target + '/chat', {"type": "sbe", "current_state": []})
				ok = true;
			}
			catch(e)
			{

			}

		}
		emit_a_check_result(db, ok, check)
	}
}

function emit_a_check_result(db, ok, check)
{
	db.add({check, ok})
}


function start_checking_events()
{
	checks.map(start_reviewing_check_results);
}

function start_reviewing_check_results(check)
{
	setInterval(check.interval, review_check_results(check))
}

const node_ids = {}
const node_aliases = {}


function set_alias(alias, id)
{
	node_ids[alias] = id
	node_aliases[id] =alias
}


function review_check_results(c)
{
	/* checker node is supposed to be always on. azure nad vmi1 are also supposed to be always on, so,
	check1 and check2 are supposed to happen at every interval, and checker node is supposed to get the result within some propagation margin.
	*/

	for (const event of get_events())
	{
		if (event.type == "alias")
			set_alias(event.alias, event.identity.id)
	}


	for (const event of get_events().reverse())
	{
		const alias = node_aliases[event.identity.id];
		if (alias == undefined)
			continue;
		for (const check of checks)
		{
			if (alias == check.node)
			{


			}
		}
	}
}


