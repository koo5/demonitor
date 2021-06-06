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







var checks = [];
var db;
const node_ids = {}
const node_aliases = {}
var last_event_ts;
const events_reversed = [];
const events = [];
const seen = {}
var alerts = [];






async function run()
{


	const config_fn = 'config.aml';
	console.log(config_fn+' :');
	const config_text = fs.readFileSync('config.aml').toString();
	console.log(config_text);
	const config = archieml.load(config_text);




	checks = [
		//{id: 0, node: 'dev', interval: 9000, type: 'chat', target: config.nodes.vmi1.url},
		{id: 1, node: 'dev', interval: 9000, type: 'chat', target: config.nodes.azure.url},
		//{id: 2, node: 'azure', interval: 9000, type: 'chat', target: process.env.VMI1},
		//{id: 3, node: 'vmi1', interval: 9000, type: 'chat', target: process.env.AZURE},
	];







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


	db = await orbitdb.log(db_address,
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
	start_http_server();

	console.log()

	// https://github.com/orbitdb/orbit-db/blob/main/API.md#replicated
	db.events.on('replicated', async (address) => {
		console.log('replicated'); /*await print_events(db);*/} )
	db.events.on('replicate', (address) =>
		console.log('going to replicate a part of the database with a peer...') )
	db.events.on('replicate.progress', (address, hash, entry, progress, have) => {
		console.log(`replicate.progress: ${address}, ${hash}, ${JSON.stringify(entry,null,'')}, ${progress}, ${have}`);
		process_event(entry);
	})
	db.events.on('load', (dbname) =>
		console.log('going to load the database...') )
	db.events.on('load.progress', (address, hash, entry, progress, total) => {
		if (progress % 100 == 0)
			console.log(`load.progress: ${address}, ${hash}, ${progress} of ${total}`)
		process_event(entry);
	})
	db.events.on('write', (address, entry, heads) => {
		//console.log(`entry was added locally to the database: ${address}, ${JSON.stringify(entry,null,'')}, ${JSON.stringify(heads)}`);
		console.log(`event was added locally to the database: ${JSON.stringify(entry.payload)}`);
		process_event(entry);
	})
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
	setInterval(async () => await beep(ipfs), 30000);
}





async function beep(ipfs)
{
	//console.log( '<beep!>');
	//await db.add({ts:moment().format()})
	const peers = await ipfs.swarm.peers({direction:true,streams:true,verbose:true,latency:true})
	console.log( `${peers.length} peers.`);
	//console.log( peers );
}
/*
function get_events(db)
{
	return db.iterator({limit: -1}).collect();
}
*/
async function print_events()
{
	console.log()
	console.log('items:')
	//const events = get_events(db);
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



function start_http_server()
{
	console.log('start_http_server..')
	const express = require('express')
	const app = express()
	const port = 3223

	app.get('/events', (req, res) =>
	{
		var result = '<html><body>';
		//const events = get_events(db);
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
		//const events = get_events(db);
		events.forEach((e) => {
			result += '<pre>'
			result += JSON.stringify(e, null, ' ');
			result += '</pre>'
		})
		result += '</body></html>';
		res.send(result)
	})

	app.get('/alerts', (req, res) =>
	{
		var result = '<html><body>';
		alerts.forEach((e) => {
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

function initialize_checks()
{
	checks.map(initialize_periodic_check);
}

function initialize_periodic_check(task)
{
	setInterval(async () => await do_task(task), task.interval);
}

async function do_task(task)
{
	console.log(`do_task(${s(task)})`);
	var ok = false;
	var error;
	if (task.type == 'chat')
	{
		try
		{
			const r = await axios.post(task.target + '/chat', {"type": "sbe", "current_state": []})
			ok = true;
		}
		catch(e)
		{
			error = e;
		}

	}
	emit_a_check_result({ok, check:task, unix_ts_ms: Date.now(), error: ss(error)});
}

function emit_a_check_result(event)
{
	db.add(event)
}


function start_checking_events()
{
	checks.map(start_reviewing_check_results);
}

function start_reviewing_check_results(check)
{
	setInterval(() => review_check_results(check), check.interval)
}



function set_alias(alias, id)
{
	node_ids[alias] = id
	node_aliases[id] =alias
}

function process_event(event)
{
	console.log(`process_event(${s(event)})`);
	if (last_event_ts > event.payload.ts)
		throw(xx);
	if (event.type == "alias")
		set_alias(event.alias, event.identity.id)
	if (!seen[event.key])
	{
		events.push(event);
		events_reversed.unshift(event);
		seen[event.key] = true
	}
	event.node_alias = node_aliases[event.identity.id];
}


function review_check_results(c)
{
	/* checker node is supposed to be always on. azure nad vmi1 are also supposed to be always on, so,
	check1 and check2 are supposed to happen at every interval, and checker node is supposed to get the result within some propagation margin.
	*/

	check_heartbeat(c);


	for (const event of events_reversed)
	{
		if (event.node_alias == undefined)
			continue;
		if (event.node_alias == check.node)
		{


		}
	}
}


function get_last_event(check, events_reversed)
{
	for (const event of events)
	{
		if (event.check?.id == check.id)
			return event;
	}
}

function check_heartbeat(check)
{
	console.log(`check_heartbeat(${JSON.stringify(check)})`)
	const last_event = get_last_event(check, events_reversed);

	var time_since_last_event = Date.now();
	if (last_event)
		time_since_last_event -= last_event.payload.unix_ts_ms;

	const propagation_max_delay = 30000;
	const expected_at_most_before = check.interval + propagation_max_delay;

	if (time_since_last_event > expected_at_most_before)
	{
		var alert = find_heartbeat_alert(check);
		if (!alert)
		{
			alerts.unshift({
				check,
				type: 'heartbeat_failure',
				time_since_last_event
			})
		}
		else
		{
			alert.occurence_count = (alert.occurence_count || 1) + 1;
			alert.time_since_last_heartbeat = time_since_last_event;
		}

	}
}

function find_heartbeat_alert(check)
{
	for (const alert of alerts)
	{
		if (check.id == alert.check_id)
			if (alert.type == 'heartbeat')
				if (!alert.is_resolved)
					return alert;
	}
}

function s(x)
{
	return JSON.stringify(x);
}

function ss(x)
{
	return JSON.stringify(x, null, ' ');
}
