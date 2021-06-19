'use strict';


var checks_module = require('./checks');


//pick one
const { create: ipfsHttp } = require('ipfs-http-client')
//const { create: ipfsHttp } = require('ipfs')


var fs = require('fs');
var archieml = require('archieml');
const OrbitDB = require('orbit-db')
const Identities = require('orbit-db-identity-provider')
var moment = require('moment');
const axios = require('axios');
const cycle = require('./cycle');
const express = require('express')
const alertmanager_api = require('@koo5/alertmanager_api');
const am = alertmanager_api.ApiClient.instance;
const am_aa = new alertmanager_api.AlertApi();


var db;
var checks = [];
const node_ids = {}
const node_aliases = {}
var last_event_ts;
const events_reversed = [];
const events = [];
const seen = {}
var alerts = [];
const program_start_ts = Date.now();
var am_alerts = [];
var node_alias;


async function load_checks(config)
{
	checks = checks_module.get_checks(config);
	let ch_id = 0;
	checks.forEach(ch => ch.id = ch_id++);
	return checks;
}

async function init_config()
{

	const config_fn = 'config.aml';
	console.log(config_fn + ' :');
	const config_text = fs.readFileSync('config.aml').toString();
	console.log(config_text);
	console.log('/' + config_fn);
	const config = archieml.load(config_text);
	am.basePath = (process.env.ALERTMANAGER_URL || 'http://localhost:9093') + '/api/v2'
	return config

}


async function init_ipfs(config)
{
	const default_bootstrap_override = config.default_bootstrap_override;
	console.log('default_bootstrap_override:')
	console.log(default_bootstrap_override)
	console.log()


	// https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/MODULE.md
	const ipfsOptions = {
		EXPERIMENTAL: {
			pubsub: true,
			dht: true
		},
		// https://github.com/ipfs/js-ipfs/blob/7cf404c8fd11888fa803c6167bd2ec62d94a2b34/docs/CONFIG.md#addresses
		config: {
			//Bootstrap: default_bootstrap_override
			Pubsub:
				{
					Router: 'gossipsub'
				},
			/*relay: {
				enabled: true, // enable relay dialer/listener (STOP)
				hop: {
					enabled: true // make this node a relay (HOP)
				}
			}*/
		},
		repo: './ipfs'
	}

	var ipfs;
	ipfs = await create(ipfsOptions);
	/* or:
	ipfs = IpfsApi('localhost', '5001')
	// If you want a programmatic way to spawn a IPFS Daemon using JavaScript, check out the ipfsd-ctl module.
	 */
	console.log(`ipfs: ${ipfs}`);

	await ipfs.config.profiles.apply('lowpower');

	const additional_bootstrap_nodes = config.additional_bootstrap_nodes || [];
	console.log('additional_bootstrap_nodes:')
	console.log(additional_bootstrap_nodes)
	console.log();
	additional_bootstrap_nodes.forEach(n => ipfs.bootstrap.add(n));

	await (config.additional_bootstrap_nodes || []).forEach(async (n) =>
	{
		try
		{
			await ipfs.swarm.connect(n)
		} catch (e)
		{
			console.log(e)

		}
	});

	return ipfs;

}

async function init_orbitdb(config, ipfs)
{
	const db_address = config.db_address || 'demonitor1';
	const identity = await Identities.createIdentity({id: 'test1'})

	/*console.log()
	console.log('publicKey:')
	console.log(identity.publicKey)*/
	console.log('node identity:')
	console.log(identity.id)

	const orbitdb = await OrbitDB.createInstance(ipfs, {identity})
	/*console.log()
	console.log('orbitdb:')
	console.log(orbitdb)*/


	const write_permission = config.write_permission || ['*'];
	console.log('write_permission:')
	console.log(write_permission)

	db = await orbitdb.log(db_address,
		{
			create: config.create,
			accessController: {
				canAppend: (entry) => true,
				write: ["*"]
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
	console.log()

	// https://github.com/orbitdb/orbit-db/blob/main/API.md#replicated
	db.events.on('replicated', async (address) =>
	{
		console.log('replicated'); /*await print_events(db);*/
	})
	db.events.on('replicate', (address) =>
		console.log('going to replicate a part of the database with a peer...'))
	db.events.on('replicate.progress', (address, hash, entry, progress, have) =>
	{
		console.log(`replicate.progress: ${address}, ${hash}, ${JSON.stringify(entry, null, '')}, ${progress}, ${have}`);
		process_event(entry);
	})
	db.events.on('load', (dbname) =>
		console.log('going to load the database...'))
	db.events.on('load.progress', (address, hash, entry, progress, total) =>
	{
		if (progress % 100 == 0)
			console.log(`load.progress: ${address}, ${hash}, ${progress} of ${total}`)
		process_event(entry);
	})
	db.events.on('write', (address, entry, heads) =>
	{
		//console.log(`entry was added locally to the database: ${address}, ${JSON.stringify(entry,null,'')}, ${JSON.stringify(heads)}`);
		console.log(`event was added locally to the database: ${JSON.stringify(entry.payload)}`);
		process_event(entry);
	})
	db.events.on('peer', (peer) =>
		console.log(`peer: ${peer}`))
	db.events.on('closed', (dbname) =>
		console.log('closed'))
	db.events.on('peer.exchanged', (peer, address, heads) =>
	{
		console.log(`peer.exchanged: ${peer}, ${JSON.stringify(address, null, '')}, ${heads}`)
	})
	db.events.on('ready', () =>
	{
		console.log('database is now ready to be queried');

		start_checking_events();
		setInterval(push_alerts_out, 1000 * 15);

	})
	return db;
}

async function run()
{

	let config = await init_config();
	checks = await load_checks(config);
	let ipfs = await init_ipfs(config);
	let db = await init_orbitdb(config, ipfs);
	/*
	start_http_server();



	node_alias = config.node_alias;
	if (node_alias)
		await db.add({type:'alias', alias:node_alias});

	initialize_checks();

	 */
	setInterval(async () => await beep(ipfs), 30000);

}


async function beep(ipfs)
{
	//console.log( '<beep!>');
	//await db.add({ts:moment().format()})
	const peers = await ipfs.swarm.peers({direction: true, streams: true, verbose: true, latency: true})
	console.log(`${peers.length} peers.`);
	console.log(peers);
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
	events.map((e) =>
	{
		console.log({
			source: e.identity.id,
			value: e.payload.value
		});
	});
	console.log('(' + events.length + ')')
}


(async () =>
{
	try
	{
		await run();
	} catch (e)
	{
		console.log(e);
		process.exit(1);
	}
})();


function start_http_server()
{
	console.log('start_http_server..')

	const app = express()

	app.get('/events', (req, res) =>
	{
		var result = '<html><body>';
		//const events = get_events(db);
		events.forEach((e) =>
		{
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
		events.forEach((e) =>
		{
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
		alerts.forEach((e) =>
		{
			result += '<pre>'
			result += JSON.stringify(e, null, ' ');
			result += '</pre>'
		})
		result += '</body></html>';
		res.send(result)
	})

	app.get('/events_full/:hash', function (req, res)
	{
		var result = '<html><body>';
		events.forEach((e) =>
		{
			if (e.hash == req.params.hash)
			{
				result += '<pre>'
				result += ss(e);
				result += '</pre>'
			}
		})
		result += '</body></html>';
		res.send(result)

	})

	app.use(function (req, res, next)
	{
		console.log({url: req.url, method: req.method});
		res.status(404).send("Sorry can't find that!")
	})

	const port = 3223

	app.listen(port, () =>
	{
		console.log(`Example app listening at http://localhost:${port}`)
	})

}

function initialize_checks()
{
	checks.forEach(ch =>
	{
		if (node_alias == ch.node)
			initialize_periodic_check(ch);
	});
}

function initialize_periodic_check(task)
{
	setInterval(async () => await do_task(task), task.interval);
}

async function axios_post_with_timeout_workaround(url, data, config)
{
	const timeout = config.timeout;
	const source = axios.CancelToken.source();
	let response = null;
	setTimeout(() =>
	{
		if (response === null)
		{
			source.cancel(`timeout of ${timeout}ms`);
		}
	}, timeout);
	response = await axios.post(url, data, {cancelToken: source.token});
	return response;
}

async function do_task(task)
{
	console.log(`do_task(${s(task)})`);
	var ok = false;
	var error;
	var result;
	if (task.type == 'chat')
	{
		try
		{
			const timeout = task.timeout || 10 * 60000;
			result = await axios_post_with_timeout_workaround(
				task.target + '/chat',
				{
					"type": "sbe",
					"current_state": []
				},
				{timeout});
			result = {status: result.status, data: result.data}
			console.log(s(result));
			if (result.status == 200 && result.data.status != 'error')
				ok = true;
		} catch (e)
		{
			error = e;
			console.log(e)
		}

	}
	emit_a_check_result({ok, check: task, unix_ts_ms: Date.now(), result: ss(result), error: ss(error)});
}

function emit_a_check_result(event)
{
	db.add({type: 'check_result', ...event})
}


function start_checking_events()
{
	checks.map(start_reviewing_check_results);
}

function start_reviewing_check_results(check)
{
	setInterval(() => check_heartbeat(check), check.interval)
}


function set_alias(alias, id)
{
	node_ids[alias] = id
	node_aliases[id] = alias
}

function process_event(entry)
{
	//console.log(`process_event(${s(entry)})`);
	const event = entry.payload.value;

	if (last_event_ts > event.unix_ts_ms)
		throw('this shouldnt happen');

	if (event.type == "alias")
		set_alias(event.alias, entry.identity.id)

	if (!seen[entry.hash])
	{
		events.push(entry);
		events_reversed.unshift(entry);
		seen[entry.hash] = true
		process_event2(entry);
	}

	entry.node_alias = node_aliases[entry.identity.id];
}

function process_event2(entry)
{
	const event = entry.payload.value;
	console.log(`process_event2(${s(event)})`);
	if (event.type == 'check_result')
	{
		const check = event.check
		const type = 'check_failure'
		if (!event.ok)
		{
			const alert = make_or_update_alert(type, check, Date.now());
			alert.generatorURL = `/events/${entry.hash}`
			if (alert.streak > 1)
				alert.severity = 'critical';
			else
				alert.severity = 'info';
		}
		else
		{
			maybe_resolve_alert(type, check)
		}
	}
}

function get_last_event(check)
{
	//console.log(`get_last_event(${s(check)})`);
	for (const event of events)
	{
		//console.log(`(const ${s(event)} of events)`);
		if (event.payload.check?.id == check.id)
			return event;
	}
}

function check_heartbeat(check)
{
	console.log(`check_heartbeat(${JSON.stringify(check)})`)
	const last_event = get_last_event(check);
	const now = Date.now();
	const time_since_program_start = now - program_start_ts;
	const propagation_max_delay = 30000;
	const expected_at_most_before = check.interval + propagation_max_delay;
	var time_since_last_heartbeat = now;
	time_since_last_heartbeat -= last_event?.payload.value.unix_ts_ms || 0;

	const type = 'heartbeat_failure';
	const ok = time_since_last_heartbeat <= expected_at_most_before && expected_at_most_before < time_since_program_start

	if (ok)
	{
		const alert = make_or_update_alert(type, check, now);
		alert.time_since_last_heartbeat = time_since_last_heartbeat;
		alert.last_event = last_event?.payload.value || null
	}
	else
	{
		maybe_resolve_alert(type, check)
	}
}


function make_or_update_alert(type, check, now)
{
	let alert = find_last_alert(type, check);
	if (alert && !alert.is_resolved)
	{
		alert.streak = (alert.streak || 1) + 1;
	}
	else
	{
		alerts.forEach(a =>
		{
			if (!a.is_resolved && a.check == check && a.type == type)
				throw('this shouldnt happen');
		})
		alert = {
			generatorURL: `/checks/${check.id}`,
			check,
			type,
			ts: now
		}
		alerts.unshift(alert)
	}
	return alert
}

function maybe_resolve_alert(type, check)
{
	const alert = find_last_alert(type, check);
	if (alert)
	{
		if (!alert.is_resolved)
			alert.is_resolved = true
	}
}


function find_last_alert(type, check)
{
	for (const alert of alerts)
	{
		if (check.id == alert.check.id)
			if (alert.type == type)
				return alert;
	}
}

function s(x)
{
	return JSON.stringify(cycle.decycle(x));
}

function ss(x)
{
	return JSON.stringify(cycle.decycle(x), null, ' ');
}


async function push_alerts_out()
{
	/*
	The scheme for v2 is specified as an OpenAPI specification that can be found in the Alertmanager repository. Clients are expected to continuously re-send alerts as long as they are still active (usually on the order of 30 seconds to 3 minutes). Clients can push a list of alerts to Alertmanager via a POST request.
	 */
	am_alerts = [
		{
			"labels": {
				"alertname": 'DeadMansSwitch'
			}
		}
	]

	alerts.forEach(alert =>
	{
		//if (!alert.is_resolved && alert.severity != 'info')
		if (!alert.is_resolved)
		{

			const ts = new Date(alert.ts);
			const end = new Date(alert.ts + 60 * 60000);//1hr
			am_alerts.push(
				// https://prometheus.io/docs/alerting/latest/clients/#sending-alerts
				{
					"labels": {
						"alertname": alert.type,
						"node": alert.check.node,
						"target": alert.check.target,
						type: alert.check.type,
					},
					"annotations": {
						severity: alert.severity,
						resolved: alert.is_resolved?.toString(),
						time_since_last_heartbeat: alert.time_since_last_heartbeat?.toString(),
						ts: ts.toString(),
						streak: alert.streak?.toString()
					},
					"generatorURL": alert.generatorURL,

					//"startsAt": ts.toISOString(),//rfcwhat?
					"endsAt": end.toISOString(),

				}
			)

		}
	})

	console.log(`push_alerts_out: ${s(am_alerts)}`);
	am_aa.postAlerts(am_alerts, error =>
	{
		if (error)
		{
			console.log(error);
			db.add({type: 'demonitor_warning', msg: s(error)})
		}
	})
}


/*
todo:
db rotation system:
Allow others to always find current eventlog: use a keyvalue to publish current eventlog.
Allow traversing a chain of eventlogs: When eventlog reaches X entries, post pointers to the other eventlog to both the new and the old eventlog.
 */

