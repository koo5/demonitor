const cycle = require('../cycle');
const got = require('got');
var express = require('express');
var router = express.Router();

async function post(url, data, config)
{
	const timeout = config.timeout;
	response = await got(url, {
		json: data,
		responseType: 'json',
		method: 'POST',
		timeout: config.timeout,
		retry: {methods:['POST']},
		username: config.user,
		password: config.pass,

	});
	return response;
}

function s(x)
{
	return JSON.stringify(cycle.decycle(x));
}

function ss(x)
{
	return JSON.stringify(cycle.decycle(x), null, ' ');
}



router.post('/check', async function (req, res, next)
{
	const task = req.body;
	console.log(`do_task(${s(task)})`);
	res.setTimeout(60000 + task.interval);
	var ok = false;
	var error;
	var result;
	if (task.type == 'chat')
	{
		try
		{
			const timeout = task.timeout || 10 * 60000;
			result = await post(
				task.target + '/chat',
				{
					"type": "sbe",
					"current_state": []
				},
				{timeout, user:check.http_basicauth_user,pass:http_basicauth_pass});
			result = {status: result.status, data: result.body}
			console.log(s(result));
			if (result.status == 200 && result.data.status != 'error')
				ok = true;
		} catch (e)
		{
			error = e;
			console.log(ss(e))
		}

	}
	res.send({ok, check: task, unix_ts_ms: Date.now(), result: ss(result), error: ss(error)});
});



module.exports = router;
