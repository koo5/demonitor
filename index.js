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
const cycle = require('./cycle');
const alertmanager_api = require('alertmanager_api');
const am = alertmanager_api.ApiClient.instance;
am.basePath = 'http://localhost:9093/api/v2'
//am.basePath = 'http://localhost:9093'
const am_aa = new alertmanager_api.AlertApi();


var checks = [];
var db;
const node_ids = {}
const node_aliases = {}
var last_event_ts;
const events_reversed = [];
const events = [];
const seen = {}
var alerts = [];
const program_start_ts = Date.now();
var am_alerts = [];


async function run()
{


	const config_fn = 'config.aml';
	console.log(config_fn + ' :');
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
		setInterval(push_alerts_out, 1000 * 5);

	})

	initialize_checks();
	setInterval(async () => await beep(ipfs), 30000);
}


async function beep(ipfs)
{
	//console.log( '<beep!>');
	//await db.add({ts:moment().format()})
	const peers = await ipfs.swarm.peers({direction: true, streams: true, verbose: true, latency: true})
	console.log(`${peers.length} peers.`);
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

	app.get('/api/v2/status', function (req, res)
	{
		res.send({
				"cluster": {
					"name": "01F7MX438YSVZY2AGMEJ56DKGM",
					"peers": [{"address": "172.17.0.2:9094", "name": "01F7MX438YSVZY2AGMEJ56DKGM"}],
					"status": "ready"
				},
				"config": {"original": "global:\n  resolve_timeout: 5m\n  http_config:\n    follow_redirects: true\n  smtp_hello: localhost\n  smtp_require_tls: true\n  pagerduty_url: https://events.pagerduty.com/v2/enqueue\n  opsgenie_api_url: https://api.opsgenie.com/\n  wechat_api_url: https://qyapi.weixin.qq.com/cgi-bin/\n  victorops_api_url: https://alert.victorops.com/integrations/generic/20131114/alert/\nroute:\n  receiver: web.hook\n  group_by:\n  - alertname\n  continue: false\n  group_wait: 30s\n  group_interval: 5m\n  repeat_interval: 1h\ninhibit_rules:\n- source_match:\n    severity: critical\n  target_match:\n    severity: warning\n  equal:\n  - alertname\n  - dev\n  - instance\nreceivers:\n- name: web.hook\n  webhook_configs:\n  - send_resolved: true\n    http_config:\n      follow_redirects: true\n    url: http://127.0.0.1:5001/\n    max_alerts: 0\ntemplates: []\n"},
				"uptime": "2021-06-08T04:12:07.853Z",
				"versionInfo": {
					"branch": "HEAD",
					"buildDate": "20210602-07:50:37",
					"buildUser": "root@b595c7f32520",
					"goVersion": "go1.16.4",
					"revision": "44f8adc06af5101ad64bd8b9c8b18273f2922051",
					"version": "0.22.2"
				}
			}
		);
	})

	app.get('/metrics', function (req, res)
	{
		//res.send(`events ${events.length}\nversion v0.22.0\n`);
		res.send(`# HELP alertmanager_alerts How many alerts by state.
# TYPE alertmanager_alerts gauge
alertmanager_alerts{state="active"} 0
alertmanager_alerts{state="suppressed"} 0
# HELP alertmanager_alerts_invalid_total The total number of received alerts that were invalid.
# TYPE alertmanager_alerts_invalid_total counter
alertmanager_alerts_invalid_total{version="v1"} 0
alertmanager_alerts_invalid_total{version="v2"} 0
# HELP alertmanager_alerts_received_total The total number of received alerts.
# TYPE alertmanager_alerts_received_total counter
alertmanager_alerts_received_total{status="firing",version="v1"} 0
alertmanager_alerts_received_total{status="firing",version="v2"} 0
alertmanager_alerts_received_total{status="resolved",version="v1"} 0
alertmanager_alerts_received_total{status="resolved",version="v2"} 0
# HELP alertmanager_build_info A metric with a constant '1' value labeled by version, revision, branch, and goversion from which alertmanager was built.
# TYPE alertmanager_build_info gauge
alertmanager_build_info{branch="HEAD",goversion="go1.16.4",revision="44f8adc06af5101ad64bd8b9c8b18273f2922051",version="0.22.2"} 1
# HELP alertmanager_cluster_alive_messages_total Total number of received alive messages.
# TYPE alertmanager_cluster_alive_messages_total counter
alertmanager_cluster_alive_messages_total{peer="01F7MX438YSVZY2AGMEJ56DKGM"} 1
# HELP alertmanager_cluster_enabled Indicates whether the clustering is enabled or not.
# TYPE alertmanager_cluster_enabled gauge
alertmanager_cluster_enabled 1
# HELP alertmanager_cluster_failed_peers Number indicating the current number of failed peers in the cluster.
# TYPE alertmanager_cluster_failed_peers gauge
alertmanager_cluster_failed_peers 0
# HELP alertmanager_cluster_health_score Health score of the cluster. Lower values are better and zero means 'totally healthy'.
# TYPE alertmanager_cluster_health_score gauge
alertmanager_cluster_health_score 0
# HELP alertmanager_cluster_members Number indicating current number of members in cluster.
# TYPE alertmanager_cluster_members gauge
alertmanager_cluster_members 1
# HELP alertmanager_cluster_messages_pruned_total Total number of cluster messages pruned.
# TYPE alertmanager_cluster_messages_pruned_total counter
alertmanager_cluster_messages_pruned_total 0
# HELP alertmanager_cluster_messages_queued Number of cluster messages which are queued.
# TYPE alertmanager_cluster_messages_queued gauge
alertmanager_cluster_messages_queued 0
# HELP alertmanager_cluster_messages_received_size_total Total size of cluster messages received.
# TYPE alertmanager_cluster_messages_received_size_total counter
alertmanager_cluster_messages_received_size_total{msg_type="full_state"} 0
alertmanager_cluster_messages_received_size_total{msg_type="update"} 0
# HELP alertmanager_cluster_messages_received_total Total number of cluster messages received.
# TYPE alertmanager_cluster_messages_received_total counter
alertmanager_cluster_messages_received_total{msg_type="full_state"} 0
alertmanager_cluster_messages_received_total{msg_type="update"} 0
# HELP alertmanager_cluster_messages_sent_size_total Total size of cluster messages sent.
# TYPE alertmanager_cluster_messages_sent_size_total counter
alertmanager_cluster_messages_sent_size_total{msg_type="full_state"} 0
alertmanager_cluster_messages_sent_size_total{msg_type="update"} 0
# HELP alertmanager_cluster_messages_sent_total Total number of cluster messages sent.
# TYPE alertmanager_cluster_messages_sent_total counter
alertmanager_cluster_messages_sent_total{msg_type="full_state"} 0
alertmanager_cluster_messages_sent_total{msg_type="update"} 0
# HELP alertmanager_cluster_peer_info A metric with a constant '1' value labeled by peer name.
# TYPE alertmanager_cluster_peer_info gauge
alertmanager_cluster_peer_info{peer="01F7MX438YSVZY2AGMEJ56DKGM"} 1
# HELP alertmanager_cluster_peers_joined_total A counter of the number of peers that have joined.
# TYPE alertmanager_cluster_peers_joined_total counter
alertmanager_cluster_peers_joined_total 1
# HELP alertmanager_cluster_peers_left_total A counter of the number of peers that have left.
# TYPE alertmanager_cluster_peers_left_total counter
alertmanager_cluster_peers_left_total 0
# HELP alertmanager_cluster_peers_update_total A counter of the number of peers that have updated metadata.
# TYPE alertmanager_cluster_peers_update_total counter
alertmanager_cluster_peers_update_total 0
# HELP alertmanager_cluster_reconnections_failed_total A counter of the number of failed cluster peer reconnection attempts.
# TYPE alertmanager_cluster_reconnections_failed_total counter
alertmanager_cluster_reconnections_failed_total 0
# HELP alertmanager_cluster_reconnections_total A counter of the number of cluster peer reconnections.
# TYPE alertmanager_cluster_reconnections_total counter
alertmanager_cluster_reconnections_total 0
# HELP alertmanager_cluster_refresh_join_failed_total A counter of the number of failed cluster peer joined attempts via refresh.
# TYPE alertmanager_cluster_refresh_join_failed_total counter
alertmanager_cluster_refresh_join_failed_total 0
# HELP alertmanager_cluster_refresh_join_total A counter of the number of cluster peer joined via refresh.
# TYPE alertmanager_cluster_refresh_join_total counter
alertmanager_cluster_refresh_join_total 0
# HELP alertmanager_config_hash Hash of the currently loaded alertmanager configuration.
# TYPE alertmanager_config_hash gauge
alertmanager_config_hash 2.56043898992579e+14
# HELP alertmanager_config_last_reload_success_timestamp_seconds Timestamp of the last successful configuration reload.
# TYPE alertmanager_config_last_reload_success_timestamp_seconds gauge
alertmanager_config_last_reload_success_timestamp_seconds 1.6231255279224417e+09
# HELP alertmanager_config_last_reload_successful Whether the last configuration reload attempt was successful.
# TYPE alertmanager_config_last_reload_successful gauge
alertmanager_config_last_reload_successful 1
# HELP alertmanager_dispatcher_aggregation_groups Number of active aggregation groups
# TYPE alertmanager_dispatcher_aggregation_groups gauge
alertmanager_dispatcher_aggregation_groups 0
# HELP alertmanager_dispatcher_alert_processing_duration_seconds Summary of latencies for the processing of alerts.
# TYPE alertmanager_dispatcher_alert_processing_duration_seconds summary
alertmanager_dispatcher_alert_processing_duration_seconds_sum 0
alertmanager_dispatcher_alert_processing_duration_seconds_count 0
# HELP alertmanager_http_concurrency_limit_exceeded_total Total number of times an HTTP request failed because the concurrency limit was reached.
# TYPE alertmanager_http_concurrency_limit_exceeded_total counter
alertmanager_http_concurrency_limit_exceeded_total{method="get"} 0
# HELP alertmanager_http_requests_in_flight Current number of HTTP requests being processed.
# TYPE alertmanager_http_requests_in_flight gauge
alertmanager_http_requests_in_flight{method="get"} 1
# HELP alertmanager_integrations Number of configured integrations.
# TYPE alertmanager_integrations gauge
alertmanager_integrations 1
# HELP alertmanager_nflog_gc_duration_seconds Duration of the last notification log garbage collection cycle.
# TYPE alertmanager_nflog_gc_duration_seconds summary
alertmanager_nflog_gc_duration_seconds_sum 0
alertmanager_nflog_gc_duration_seconds_count 0
# HELP alertmanager_nflog_gossip_messages_propagated_total Number of received gossip messages that have been further gossiped.
# TYPE alertmanager_nflog_gossip_messages_propagated_total counter
alertmanager_nflog_gossip_messages_propagated_total 0
# HELP alertmanager_nflog_queries_total Number of notification log queries were received.
# TYPE alertmanager_nflog_queries_total counter
alertmanager_nflog_queries_total 0
# HELP alertmanager_nflog_query_duration_seconds Duration of notification log query evaluation.
# TYPE alertmanager_nflog_query_duration_seconds histogram
alertmanager_nflog_query_duration_seconds_bucket{le="0.005"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="0.01"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="0.025"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="0.05"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="0.1"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="0.25"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="0.5"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="1"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="2.5"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="5"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="10"} 0
alertmanager_nflog_query_duration_seconds_bucket{le="+Inf"} 0
alertmanager_nflog_query_duration_seconds_sum 0
alertmanager_nflog_query_duration_seconds_count 0
# HELP alertmanager_nflog_query_errors_total Number notification log received queries that failed.
# TYPE alertmanager_nflog_query_errors_total counter
alertmanager_nflog_query_errors_total 0
# HELP alertmanager_nflog_snapshot_duration_seconds Duration of the last notification log snapshot.
# TYPE alertmanager_nflog_snapshot_duration_seconds summary
alertmanager_nflog_snapshot_duration_seconds_sum 0
alertmanager_nflog_snapshot_duration_seconds_count 0
# HELP alertmanager_nflog_snapshot_size_bytes Size of the last notification log snapshot in bytes.
# TYPE alertmanager_nflog_snapshot_size_bytes gauge
alertmanager_nflog_snapshot_size_bytes 0
# HELP alertmanager_notification_latency_seconds The latency of notifications in seconds.
# TYPE alertmanager_notification_latency_seconds histogram
alertmanager_notification_latency_seconds_bucket{integration="email",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="email",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="email",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="email",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="email",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="email",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="email"} 0
alertmanager_notification_latency_seconds_count{integration="email"} 0
alertmanager_notification_latency_seconds_bucket{integration="opsgenie",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="opsgenie",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="opsgenie",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="opsgenie",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="opsgenie",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="opsgenie",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="opsgenie"} 0
alertmanager_notification_latency_seconds_count{integration="opsgenie"} 0
alertmanager_notification_latency_seconds_bucket{integration="pagerduty",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="pagerduty",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="pagerduty",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="pagerduty",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="pagerduty",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="pagerduty",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="pagerduty"} 0
alertmanager_notification_latency_seconds_count{integration="pagerduty"} 0
alertmanager_notification_latency_seconds_bucket{integration="pushover",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="pushover",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="pushover",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="pushover",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="pushover",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="pushover",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="pushover"} 0
alertmanager_notification_latency_seconds_count{integration="pushover"} 0
alertmanager_notification_latency_seconds_bucket{integration="slack",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="slack",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="slack",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="slack",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="slack",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="slack",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="slack"} 0
alertmanager_notification_latency_seconds_count{integration="slack"} 0
alertmanager_notification_latency_seconds_bucket{integration="victorops",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="victorops",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="victorops",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="victorops",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="victorops",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="victorops",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="victorops"} 0
alertmanager_notification_latency_seconds_count{integration="victorops"} 0
alertmanager_notification_latency_seconds_bucket{integration="webhook",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="webhook",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="webhook",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="webhook",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="webhook",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="webhook",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="webhook"} 0
alertmanager_notification_latency_seconds_count{integration="webhook"} 0
alertmanager_notification_latency_seconds_bucket{integration="wechat",le="1"} 0
alertmanager_notification_latency_seconds_bucket{integration="wechat",le="5"} 0
alertmanager_notification_latency_seconds_bucket{integration="wechat",le="10"} 0
alertmanager_notification_latency_seconds_bucket{integration="wechat",le="15"} 0
alertmanager_notification_latency_seconds_bucket{integration="wechat",le="20"} 0
alertmanager_notification_latency_seconds_bucket{integration="wechat",le="+Inf"} 0
alertmanager_notification_latency_seconds_sum{integration="wechat"} 0
alertmanager_notification_latency_seconds_count{integration="wechat"} 0
# HELP alertmanager_notification_requests_failed_total The total number of failed notification requests.
# TYPE alertmanager_notification_requests_failed_total counter
alertmanager_notification_requests_failed_total{integration="email"} 0
alertmanager_notification_requests_failed_total{integration="opsgenie"} 0
alertmanager_notification_requests_failed_total{integration="pagerduty"} 0
alertmanager_notification_requests_failed_total{integration="pushover"} 0
alertmanager_notification_requests_failed_total{integration="slack"} 0
alertmanager_notification_requests_failed_total{integration="victorops"} 0
alertmanager_notification_requests_failed_total{integration="webhook"} 0
alertmanager_notification_requests_failed_total{integration="wechat"} 0
# HELP alertmanager_notification_requests_total The total number of attempted notification requests.
# TYPE alertmanager_notification_requests_total counter
alertmanager_notification_requests_total{integration="email"} 0
alertmanager_notification_requests_total{integration="opsgenie"} 0
alertmanager_notification_requests_total{integration="pagerduty"} 0
alertmanager_notification_requests_total{integration="pushover"} 0
alertmanager_notification_requests_total{integration="slack"} 0
alertmanager_notification_requests_total{integration="victorops"} 0
alertmanager_notification_requests_total{integration="webhook"} 0
alertmanager_notification_requests_total{integration="wechat"} 0
# HELP alertmanager_notifications_failed_total The total number of failed notifications.
# TYPE alertmanager_notifications_failed_total counter
alertmanager_notifications_failed_total{integration="email"} 0
alertmanager_notifications_failed_total{integration="opsgenie"} 0
alertmanager_notifications_failed_total{integration="pagerduty"} 0
alertmanager_notifications_failed_total{integration="pushover"} 0
alertmanager_notifications_failed_total{integration="slack"} 0
alertmanager_notifications_failed_total{integration="victorops"} 0
alertmanager_notifications_failed_total{integration="webhook"} 0
alertmanager_notifications_failed_total{integration="wechat"} 0
# HELP alertmanager_notifications_total The total number of attempted notifications.
# TYPE alertmanager_notifications_total counter
alertmanager_notifications_total{integration="email"} 0
alertmanager_notifications_total{integration="opsgenie"} 0
alertmanager_notifications_total{integration="pagerduty"} 0
alertmanager_notifications_total{integration="pushover"} 0
alertmanager_notifications_total{integration="slack"} 0
alertmanager_notifications_total{integration="victorops"} 0
alertmanager_notifications_total{integration="webhook"} 0
alertmanager_notifications_total{integration="wechat"} 0
# HELP alertmanager_oversize_gossip_message_duration_seconds Duration of oversized gossip message requests.
# TYPE alertmanager_oversize_gossip_message_duration_seconds histogram
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="0.005"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="0.01"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="0.025"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="0.05"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="0.1"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="0.25"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="0.5"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="1"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="2.5"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="5"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="10"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="nfl",le="+Inf"} 0
alertmanager_oversize_gossip_message_duration_seconds_sum{key="nfl"} 0
alertmanager_oversize_gossip_message_duration_seconds_count{key="nfl"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="0.005"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="0.01"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="0.025"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="0.05"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="0.1"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="0.25"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="0.5"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="1"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="2.5"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="5"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="10"} 0
alertmanager_oversize_gossip_message_duration_seconds_bucket{key="sil",le="+Inf"} 0
alertmanager_oversize_gossip_message_duration_seconds_sum{key="sil"} 0
alertmanager_oversize_gossip_message_duration_seconds_count{key="sil"} 0
# HELP alertmanager_oversized_gossip_message_dropped_total Number of oversized gossip messages that were dropped due to a full message queue.
# TYPE alertmanager_oversized_gossip_message_dropped_total counter
alertmanager_oversized_gossip_message_dropped_total{key="nfl"} 0
alertmanager_oversized_gossip_message_dropped_total{key="sil"} 0
# HELP alertmanager_oversized_gossip_message_failure_total Number of oversized gossip message sends that failed.
# TYPE alertmanager_oversized_gossip_message_failure_total counter
alertmanager_oversized_gossip_message_failure_total{key="nfl"} 0
alertmanager_oversized_gossip_message_failure_total{key="sil"} 0
# HELP alertmanager_oversized_gossip_message_sent_total Number of oversized gossip message sent.
# TYPE alertmanager_oversized_gossip_message_sent_total counter
alertmanager_oversized_gossip_message_sent_total{key="nfl"} 0
alertmanager_oversized_gossip_message_sent_total{key="sil"} 0
# HELP alertmanager_peer_position Position the Alertmanager instance believes it's in. The position determines a peer's behavior in the cluster.
# TYPE alertmanager_peer_position gauge
alertmanager_peer_position 0
# HELP alertmanager_receivers Number of configured receivers.
# TYPE alertmanager_receivers gauge
alertmanager_receivers 1
# HELP alertmanager_silences How many silences by state.
# TYPE alertmanager_silences gauge
alertmanager_silences{state="active"} 0
alertmanager_silences{state="expired"} 0
alertmanager_silences{state="pending"} 0
# HELP alertmanager_silences_gc_duration_seconds Duration of the last silence garbage collection cycle.
# TYPE alertmanager_silences_gc_duration_seconds summary
alertmanager_silences_gc_duration_seconds_sum 0
alertmanager_silences_gc_duration_seconds_count 0
# HELP alertmanager_silences_gossip_messages_propagated_total Number of received gossip messages that have been further gossiped.
# TYPE alertmanager_silences_gossip_messages_propagated_total counter
alertmanager_silences_gossip_messages_propagated_total 0
# HELP alertmanager_silences_queries_total How many silence queries were received.
# TYPE alertmanager_silences_queries_total counter
alertmanager_silences_queries_total 1
# HELP alertmanager_silences_query_duration_seconds Duration of silence query evaluation.
# TYPE alertmanager_silences_query_duration_seconds histogram
alertmanager_silences_query_duration_seconds_bucket{le="0.005"} 0
alertmanager_silences_query_duration_seconds_bucket{le="0.01"} 0
alertmanager_silences_query_duration_seconds_bucket{le="0.025"} 0
alertmanager_silences_query_duration_seconds_bucket{le="0.05"} 0
alertmanager_silences_query_duration_seconds_bucket{le="0.1"} 0
alertmanager_silences_query_duration_seconds_bucket{le="0.25"} 0
alertmanager_silences_query_duration_seconds_bucket{le="0.5"} 0
alertmanager_silences_query_duration_seconds_bucket{le="1"} 0
alertmanager_silences_query_duration_seconds_bucket{le="2.5"} 0
alertmanager_silences_query_duration_seconds_bucket{le="5"} 0
alertmanager_silences_query_duration_seconds_bucket{le="10"} 0
alertmanager_silences_query_duration_seconds_bucket{le="+Inf"} 0
alertmanager_silences_query_duration_seconds_sum 0
alertmanager_silences_query_duration_seconds_count 0
# HELP alertmanager_silences_query_errors_total How many silence received queries did not succeed.
# TYPE alertmanager_silences_query_errors_total counter
alertmanager_silences_query_errors_total 0
# HELP alertmanager_silences_snapshot_duration_seconds Duration of the last silence snapshot.
# TYPE alertmanager_silences_snapshot_duration_seconds summary
alertmanager_silences_snapshot_duration_seconds_sum 0
alertmanager_silences_snapshot_duration_seconds_count 0
# HELP alertmanager_silences_snapshot_size_bytes Size of the last silence snapshot in bytes.
# TYPE alertmanager_silences_snapshot_size_bytes gauge
alertmanager_silences_snapshot_size_bytes 0
# HELP go_gc_duration_seconds A summary of the pause duration of garbage collection cycles.
# TYPE go_gc_duration_seconds summary
go_gc_duration_seconds{quantile="0"} 4.8558e-05
go_gc_duration_seconds{quantile="0.25"} 9.9084e-05
go_gc_duration_seconds{quantile="0.5"} 0.000112718
go_gc_duration_seconds{quantile="0.75"} 0.000289254
go_gc_duration_seconds{quantile="1"} 0.000779197
go_gc_duration_seconds_sum 0.001432127
go_gc_duration_seconds_count 6
# HELP go_goroutines Number of goroutines that currently exist.
# TYPE go_goroutines gauge
go_goroutines 31
# HELP go_info Information about the Go environment.
# TYPE go_info gauge
go_info{version="go1.16.4"} 1
# HELP go_memstats_alloc_bytes Number of bytes allocated and still in use.
# TYPE go_memstats_alloc_bytes gauge
go_memstats_alloc_bytes 4.498624e+06
# HELP go_memstats_alloc_bytes_total Total number of bytes allocated, even if freed.
# TYPE go_memstats_alloc_bytes_total counter
go_memstats_alloc_bytes_total 1.4059688e+07
# HELP go_memstats_buck_hash_sys_bytes Number of bytes used by the profiling bucket hash table.
# TYPE go_memstats_buck_hash_sys_bytes gauge
go_memstats_buck_hash_sys_bytes 1.450815e+06
# HELP go_memstats_frees_total Total number of frees.
# TYPE go_memstats_frees_total counter
go_memstats_frees_total 106626
# HELP go_memstats_gc_cpu_fraction The fraction of this program's available CPU time used by the GC since the program started.
# TYPE go_memstats_gc_cpu_fraction gauge
go_memstats_gc_cpu_fraction 0.020092425586552918
# HELP go_memstats_gc_sys_bytes Number of bytes used for garbage collection system metadata.
# TYPE go_memstats_gc_sys_bytes gauge
go_memstats_gc_sys_bytes 5.310024e+06
# HELP go_memstats_heap_alloc_bytes Number of heap bytes allocated and still in use.
# TYPE go_memstats_heap_alloc_bytes gauge
go_memstats_heap_alloc_bytes 4.498624e+06
# HELP go_memstats_heap_idle_bytes Number of heap bytes waiting to be used.
# TYPE go_memstats_heap_idle_bytes gauge
go_memstats_heap_idle_bytes 5.926912e+07
# HELP go_memstats_heap_inuse_bytes Number of heap bytes that are in use.
# TYPE go_memstats_heap_inuse_bytes gauge
go_memstats_heap_inuse_bytes 7.217152e+06
# HELP go_memstats_heap_objects Number of allocated objects.
# TYPE go_memstats_heap_objects gauge
go_memstats_heap_objects 22883
# HELP go_memstats_heap_released_bytes Number of heap bytes released to OS.
# TYPE go_memstats_heap_released_bytes gauge
go_memstats_heap_released_bytes 5.7892864e+07
# HELP go_memstats_heap_sys_bytes Number of heap bytes obtained from system.
# TYPE go_memstats_heap_sys_bytes gauge
go_memstats_heap_sys_bytes 6.6486272e+07
# HELP go_memstats_last_gc_time_seconds Number of seconds since 1970 of last garbage collection.
# TYPE go_memstats_last_gc_time_seconds gauge
go_memstats_last_gc_time_seconds 1.623125527912114e+09
# HELP go_memstats_lookups_total Total number of pointer lookups.
# TYPE go_memstats_lookups_total counter
go_memstats_lookups_total 0
# HELP go_memstats_mallocs_total Total number of mallocs.
# TYPE go_memstats_mallocs_total counter
go_memstats_mallocs_total 129509
# HELP go_memstats_mcache_inuse_bytes Number of bytes in use by mcache structures.
# TYPE go_memstats_mcache_inuse_bytes gauge
go_memstats_mcache_inuse_bytes 4800
# HELP go_memstats_mcache_sys_bytes Number of bytes used for mcache structures obtained from system.
# TYPE go_memstats_mcache_sys_bytes gauge
go_memstats_mcache_sys_bytes 16384
# HELP go_memstats_mspan_inuse_bytes Number of bytes in use by mspan structures.
# TYPE go_memstats_mspan_inuse_bytes gauge
go_memstats_mspan_inuse_bytes 136000
# HELP go_memstats_mspan_sys_bytes Number of bytes used for mspan structures obtained from system.
# TYPE go_memstats_mspan_sys_bytes gauge
go_memstats_mspan_sys_bytes 147456
# HELP go_memstats_next_gc_bytes Number of heap bytes when next garbage collection will take place.
# TYPE go_memstats_next_gc_bytes gauge
go_memstats_next_gc_bytes 7.684144e+06
# HELP go_memstats_other_sys_bytes Number of bytes used for other system allocations.
# TYPE go_memstats_other_sys_bytes gauge
go_memstats_other_sys_bytes 760449
# HELP go_memstats_stack_inuse_bytes Number of bytes in use by the stack allocator.
# TYPE go_memstats_stack_inuse_bytes gauge
go_memstats_stack_inuse_bytes 622592
# HELP go_memstats_stack_sys_bytes Number of bytes obtained from system for stack allocator.
# TYPE go_memstats_stack_sys_bytes gauge
go_memstats_stack_sys_bytes 622592
# HELP go_memstats_sys_bytes Number of bytes obtained from system.
# TYPE go_memstats_sys_bytes gauge
go_memstats_sys_bytes 7.4793992e+07
# HELP go_threads Number of OS threads created.
# TYPE go_threads gauge
go_threads 9
# HELP net_conntrack_dialer_conn_attempted_total Total number of connections attempted by the given dialer a given name.
# TYPE net_conntrack_dialer_conn_attempted_total counter
net_conntrack_dialer_conn_attempted_total{dialer_name="webhook"} 0
# HELP net_conntrack_dialer_conn_closed_total Total number of connections closed which originated from the dialer of a given name.
# TYPE net_conntrack_dialer_conn_closed_total counter
net_conntrack_dialer_conn_closed_total{dialer_name="webhook"} 0
# HELP net_conntrack_dialer_conn_established_total Total number of connections successfully established by the given dialer a given name.
# TYPE net_conntrack_dialer_conn_established_total counter
net_conntrack_dialer_conn_established_total{dialer_name="webhook"} 0
# HELP net_conntrack_dialer_conn_failed_total Total number of connections failed to dial by the dialer a given name.
# TYPE net_conntrack_dialer_conn_failed_total counter
net_conntrack_dialer_conn_failed_total{dialer_name="webhook",reason="refused"} 0
net_conntrack_dialer_conn_failed_total{dialer_name="webhook",reason="resolution"} 0
net_conntrack_dialer_conn_failed_total{dialer_name="webhook",reason="timeout"} 0
net_conntrack_dialer_conn_failed_total{dialer_name="webhook",reason="unknown"} 0
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 0.18
# HELP process_max_fds Maximum number of open file descriptors.
# TYPE process_max_fds gauge
process_max_fds 1.048576e+06
# HELP process_open_fds Number of open file descriptors.
# TYPE process_open_fds gauge
process_open_fds 12
# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes 2.6906624e+07
# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.
# TYPE process_start_time_seconds gauge
process_start_time_seconds 1.6231255272e+09
# HELP process_virtual_memory_bytes Virtual memory size in bytes.
# TYPE process_virtual_memory_bytes gauge
process_virtual_memory_bytes 7.41998592e+08
# HELP process_virtual_memory_max_bytes Maximum amount of virtual memory available in bytes.
# TYPE process_virtual_memory_max_bytes gauge
process_virtual_memory_max_bytes 1.8446744073709552e+19
# HELP promhttp_metric_handler_requests_in_flight Current number of scrapes being served.
# TYPE promhttp_metric_handler_requests_in_flight gauge
promhttp_metric_handler_requests_in_flight 1
# HELP promhttp_metric_handler_requests_total Total number of scrapes by HTTP status code.
# TYPE promhttp_metric_handler_requests_total counter
promhttp_metric_handler_requests_total{code="200"} 0
promhttp_metric_handler_requests_total{code="500"} 0
promhttp_metric_handler_requests_total{code="503"} 0
\n`)

	})

	app.get('/api/v2/alerts', function (req, res)
	{
		res.send(am_alerts);
	})

	app.listen(port, () =>
	{
		console.log(`Example app listening at http://localhost:${port}`)
	})

	app.get('/api/v2/silences', function (req, res)
	{
		res.send([]);
	});
	app.get('/api/v2/groups', function (req, res)
	{
		res.send([]);
	});
	app.get('/api/v2/alerts/groups', function (req, res)
	{
		res.send([]);
	});


	app.use(function (req, res, next)
	{
		console.log({url: req.url, method: req.method});
		res.status(404).send("Sorry can't find that!")
	})


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
	var result;
	if (task.type == 'chat')
	{
		try
		{
			result = await axios.post(task.target + '/chat', {"type": "sbe", "current_state": []})
			result = {status: result.status, data: result.data}
			if (result.status == 200 && result.data.status != 'error')
				ok = true;
		} catch (e)
		{
			error = e;
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
	if (alert && !alert.is_resolved)
		alert.is_resolved = true
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
	am_alerts = []

	alerts.forEach(alert =>
	{
		if (!alert.is_resolved && alert.severity != 'info')
		{
			const ts = new Date(alert.ts);
			const end = new Date(alert.ts + 1000 * 60);
			am_alerts.push(
				// https://prometheus.io/docs/alerting/latest/clients/#sending-alerts
				{
					"labels": {
						"alertname": alert.type,
						"node": alert.check.node,
						"target": alert.check.target,
						severity: alert.severity

					},
					"annotations": {
						time_since_last_heartbeat: alert.time_since_last_heartbeat?.toString(),
						ts: ts.toString(),
						streak: alert.streak?.toString()
					},
					"generatorURL": alert.generatorURL,


					/* just experimenting with appearing as an alertmanager */
					"startsAt": ts.toISOString(),
					"endsAt": end.toISOString(),
					receivers: [{name: "web.hook"}],
					status: {
						inhibitedBy: [],
						silencedBy: [],
						state: "active"
					},
					updatedAt: ts.toISOString()

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

