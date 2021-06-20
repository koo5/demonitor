const cycle = require('../cycle');
const axios = require('axios');
var express = require('express');
var router = express.Router();


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
			error = e.message;
			console.log(error)
		}

	}
	res.send({ok, check: task, unix_ts_ms: Date.now(), result: ss(result), error: ss(error)});
});



module.exports = router;
