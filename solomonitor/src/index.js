'use strict';


var checks_module = require('./checks');



var fs = require('fs');
var archieml = require('archieml');
var moment = require('moment');
const utils = require('@koo5/utils');
const express = require('express')
const alertmanager_api = require('@koo5/alertmanager_api');
const am = alertmanager_api.ApiClient.instance;
const am_aa = new alertmanager_api.AlertApi();


var db;
var checks = [];
const node_ids = {}
const node_aliases = {}
var last_event_ts;
//const events = [];
//const seen = {}
var alerts = [];
var program_start_ts = Date.now();
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


async function run()
{
	let config = await init_config();
	checks = await load_checks(config);
	start_http_server();
	program_start_ts = Date.now();
	checks.map(start_reviewing_check_results);
	setInterval(push_alerts_out, 1000 * 60);
	initialize_checks();
	node_alias = config.node_alias;
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
		db.iterator({limit:100}).collect().forEach((e) =>
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
		db.iterator({limit:100}).collect().forEach((e) =>
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
			result += '<p>'
			result += moment(e.ts).toISOString()
			result += ':<br><pre>'
			result += JSON.stringify(e, null, '    ');
			result += '</pre></p>'
		})
		result += '</body></html>';
		res.send(result)
	})

	/*app.get('/events_full/:hash', function (req, res)
	{
		var result = '<html><body>';
		events.forEach((e) =>
		{
			if (e.hash == req.params.hash)
			{
				result += '<pre>'
				result += utils.ss(e);
				result += '</pre>'
			}
		})
		result += '</body></html>';
		res.send(result)
	})*/

	app.use(function (req, res, next)
	{
		console.log({url: req.url, method: req.method});
		res.status(404).send("Sorry can't find that!")
	})

	const port = 3223

	app.listen(port, () =>
	{
		console.log(`demonitor listening at http://localhost:${port}`)
	})

}








function initialize_checks()
{
	checks.forEach(ch => initialize_periodic_check(ch));
}

function initialize_periodic_check(task)
{
	setInterval(async () => await do_task(task), task.interval);
}

async function do_task(task)
{
	if (node_alias == task.node)
	{
		console.log(`do_task(${utils.s(task.id)})`);
		await emit_a_check_result((await utils.post('http://checker:3000/check', task, {timeout:1000})).data);
	}
}

function emit_a_check_result(event)
{
	db.add({type: 'check_result', ...event})
}


function start_reviewing_check_results(check)
{
	setInterval(() => check_heartbeat(check), 60000)
}


function set_alias(alias, id)
{
	node_ids[alias] = id
	node_aliases[id] = alias
}

function process_event(entry)
{
	//console.log(`process_event(${utils.s(entry)})`);
	const event = entry.payload.value;

	if (last_event_ts > event.unix_ts_ms)
		throw('this shouldnt happen...or it should, hmm');

	if (event.type == "alias")
		set_alias(event.alias, entry.identity.id)

	//if (!seen[entry.hash])
	{
		//events.push(entry);
		//events_reversed.unshift(entry);
		//seen[entry.hash] = true
		process_event2(entry);
	}

	entry.node_alias = node_aliases[entry.identity.id];
}

function process_event2(entry)
{
	const event = entry.payload.value;
	console.log(`process_event2(${utils.s(event)})`);
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
			alert.error = event.error;

		}
		else
		{
			maybe_resolve_alert(type, check)
		}
	}
}

function get_last_event(check)
{
	//console.log(`get_last_event(${utils.s(check)})`);
	for (const event of db.iterator({limit:100}))
	//.forEach((event) =>
//	for (var i = events.length - 1; i >= 0; i--)
	{
		//const event = events[i];
		//console.log(`(const ${utils.s(event)} of events)`);
		if (event.payload.value.check?.id == check.id)
			return event;
	};
}


function check_heartbeat(check)
{
	console.log(`check_heartbeat(${JSON.stringify(check)})`)
	const last_event = get_last_event(check);
	console.log(`last_event: ${last_event}`);
	const now = Date.now();
	const time_since_program_start = now - program_start_ts;
	const propagation_max_delay = 30000;
	const expected_at_most_before = check.interval * 2 + propagation_max_delay;
	let last_event_unix_ts_ms = last_event?.payload.value.unix_ts_ms;
	var time_since_last_heartbeat = now - (last_event_unix_ts_ms || 0);

	if (expected_at_most_before < time_since_program_start)
	{

		const type = 'heartbeat_failure';
		const ok = time_since_last_heartbeat <= expected_at_most_before;
		console.log(`ok: ${ok}, ${time_since_last_heartbeat} <= ${expected_at_most_before}`);

		if (!ok)
		{
			const alert = make_or_update_alert(type, check, now);
			alert.time_since_last_heartbeat = last_event_unix_ts_ms ? time_since_last_heartbeat : undefined,
			alert.seconds_since_last_heartbeat = alert.time_since_last_heartbeat ? (alert.time_since_last_heartbeat / 1000).toString() : "never";
			alert.last_event = last_event?.payload.value || null;
			alert.severity = 'warning'
		}
		else
		{
			maybe_resolve_alert(type, check)
		}
	}
	else
		console.log(`too soon to check.`);
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
		/*alerts.forEach(a =>
		{
			if (!a.is_resolved && a.check == check && a.type == type)
				throw('this shouldnt happen');
		})*/
		alert = {
			//generatorURL: `/checks/${check.id}`,
			check,
			type,
			first_occurence_ts: now,
			first_occurence_ts_str: ts_str(now),
		}
		alerts.unshift(alert);
		if (alert.length > 100)
			alerts.pop();
	}
	alert.ts = now;
	alert.ts_str = ts_str(now);
	return alert
}

function maybe_resolve_alert(type, check)
{
	const alert = find_last_alert(type, check);
	if (alert)
		alert.is_resolved = true;
}


function find_last_alert(type, check)
{
	if (check?.id == undefined) return undefined;
	for (const alert of alerts)
	{
		if (check.id == alert.check?.id)
			if (alert.type == type)
				return alert;
	}
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
		if (!alert.is_resolved)
		{
			am_alerts.push(
				// https://prometheus.io/docs/alerting/latest/clients/#sending-alerts
				{
					"labels": {
						"alertname": alert.type,
						"node": alert.check?.node,
						"target": alert.check?.target,
						type: alert.check?.type,
						error: alert.error
					},
					"annotations": {
						severity: alert.severity,
						resolved: alert.is_resolved?.toString(),
						seconds_since_last_heartbeat: alert.seconds_since_last_heartbeat,
						ts: alert.ts?.toString(),
						ts_str: alert.ts_str,
						first_occurence_ts: alert.first_occurence_ts?.toString(),
						first_occurence_ts_str: alert.first_occurence_ts_str,
						//ts_str_utc: ts.toISOString(),
						streak: alert.streak?.toString()
					},
					"generatorURL": alert.generatorURL,

					//"startsAt": ts.toISOString(),//rfcwhat?
					//"endsAt": end.toISOString(),
				}
			)
		}
	})

	console.log(`push_alerts_out: ${utils.ss(am_alerts)}`);
	am_aa.postAlerts(am_alerts, error =>
	{
		if (error)
		{
			console.log(error);
			db.add({type: 'demonitor_warning', msg: utils.s(error)})
		}
	})
}


function ts_str(x)
{
	if (!x) return;
	return new Date(x).toString();
}

/*
todo:
db rotation system:
Allow others to always find current eventlog: use a keyvalue to publish current eventlog.
Allow traversing a chain of eventlogs: When eventlog reaches X entries, post pointers to the other eventlog to both the new and the old eventlog.
 */

